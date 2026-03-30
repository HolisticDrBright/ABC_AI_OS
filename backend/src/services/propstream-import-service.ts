import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';

// PropStream CSV column mapping
const PROPSTREAM_COLUMNS = [
  'address', 'city', 'state', 'zip', 'owner_name', 'mailing_address',
  'equity_estimate', 'estimated_value', 'mortgage_balance', 'years_owned',
  'ownership_type', 'occupancy_status', 'lien_count', 'tax_delinquent',
  'pre_foreclosure', 'last_sale_date', 'last_sale_price',
] as const;

export interface PropStreamRow {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  owner_name?: string;
  mailing_address?: string;
  equity_estimate?: string;
  estimated_value?: string;
  mortgage_balance?: string;
  years_owned?: string;
  ownership_type?: string;
  occupancy_status?: string;
  lien_count?: string;
  tax_delinquent?: string;
  pre_foreclosure?: string;
  last_sale_date?: string;
  last_sale_price?: string;
}

function parseBoolean(val?: string): boolean {
  if (!val) return false;
  return ['true', 'yes', '1', 'y'].includes(val.toLowerCase().trim());
}

function parseFloat(val?: string): number | null {
  if (!val) return null;
  const n = Number(val.replace(/[,$]/g, ''));
  return isNaN(n) ? null : n;
}

function parseInt(val?: string): number | null {
  if (!val) return null;
  const n = Number(val);
  return isNaN(n) ? null : Math.floor(n);
}

function parseDate(val?: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function parsePropStreamCSV(csvText: string): PropStreamRow[] {
  const lines = csvText.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows: PropStreamRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

export async function importPropStreamData(
  organizationId: string,
  rows: PropStreamRow[],
  userId?: string,
) {
  const results: Array<{ row: number; action: string; leadId?: string; error?: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Try to match to existing lead by name or address
      let lead = null;

      if (row.owner_name) {
        const nameParts = row.owner_name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        lead = await db.lead.findFirst({
          where: {
            organizationId,
            OR: [
              { fullName: { contains: row.owner_name, mode: 'insensitive' } },
              { AND: [{ firstName: { contains: firstName, mode: 'insensitive' } }, { lastName: { contains: lastName, mode: 'insensitive' } }] },
            ],
          },
        });
      }

      // If no match, create new lead
      if (!lead) {
        const nameParts = (row.owner_name || 'Unknown').split(' ');
        lead = await db.lead.create({
          data: {
            organizationId,
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || null,
            fullName: row.owner_name || null,
            city: row.city,
            state: row.state,
            zip: row.zip,
            sourceLabel: 'propstream',
            externalSourceType: 'propstream',
            leadStatus: 'new',
            ownerUserId: userId,
          },
        });

        await db.leadIdentity.create({
          data: { leadId: lead.id },
        });

        await emitEvent('lead.created', { leadId: lead.id, organizationId });
      }

      // Attach property data
      await db.leadPropertyData.create({
        data: {
          leadId: lead.id,
          rawAddress: row.address,
          normalizedAddress: row.address ? `${row.address}, ${row.city}, ${row.state} ${row.zip}`.trim() : null,
          city: row.city,
          state: row.state,
          zip: row.zip,
          estimatedValue: parseFloat(row.estimated_value),
          equityEstimate: parseFloat(row.equity_estimate),
          mortgageBalance: parseFloat(row.mortgage_balance),
          yearsOwned: parseFloat(row.years_owned),
          ownershipType: row.ownership_type,
          occupancyStatus: row.occupancy_status,
          absenteeOwner: row.occupancy_status?.toLowerCase().includes('absentee') || false,
          taxDelinquent: parseBoolean(row.tax_delinquent),
          preForeclosure: parseBoolean(row.pre_foreclosure),
          lienCount: parseInt(row.lien_count),
          lastSaleDate: parseDate(row.last_sale_date),
          lastSalePrice: parseFloat(row.last_sale_price),
          dataSource: 'propstream_csv',
        },
      });

      await emitEvent('lead.updated', { leadId: lead.id, organizationId });

      results.push({ row: i + 1, action: 'imported', leadId: lead.id });
    } catch (err: any) {
      results.push({ row: i + 1, action: 'error', error: err.message });
    }
  }

  await writeAuditLog({
    organizationId,
    userId,
    entityType: 'propstream_import',
    action: 'csv_imported',
    metadata: {
      totalRows: rows.length,
      imported: results.filter((r) => r.action === 'imported').length,
      errors: results.filter((r) => r.action === 'error').length,
    },
  });

  return results;
}

export function getColumnMappingGuide(): string {
  return `PropStream CSV Column Mapping Guide
=====================================
Export your PropStream list with these columns:

address          - Property street address
city             - Property city
state            - Property state (2-letter)
zip              - Property zip code
owner_name       - Property owner full name
mailing_address  - Owner mailing address (if different)
equity_estimate  - Estimated equity ($)
estimated_value  - Estimated property value ($)
mortgage_balance - Current mortgage balance ($)
years_owned      - Years the owner has held the property
ownership_type   - Individual, Trust, LLC, etc.
occupancy_status - Owner Occupied, Absentee, Vacant
lien_count       - Number of liens on the property
tax_delinquent   - true/false
pre_foreclosure  - true/false
last_sale_date   - Date of last sale (YYYY-MM-DD)
last_sale_price  - Last sale price ($)

Export as CSV with headers. Upload via the PropStream tab on the Import page.`;
}
