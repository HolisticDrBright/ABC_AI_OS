/**
 * BatchSkipTracing — Residential phone/email lookup fallback.
 * Activates only when: no PropStream CSV, lead has address, Apollo returned no phone/email.
 */

import { db } from '../lib/db.js';
import { callExternalAPI } from '../lib/external-api.js';
import { writeAuditLog } from '../lib/audit.js';
import { config } from '../lib/config.js';

interface SkipTraceResult {
  phones: string[];
  emails: string[];
  confidence: number;
}

export async function skipTraceLead(leadId: string, organizationId: string): Promise<SkipTraceResult | null> {
  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId },
    include: {
      propertyData: { take: 1, orderBy: { createdAt: 'desc' } },
      enrichments: { take: 1, orderBy: { lastEnrichedAt: 'desc' } },
    },
  });

  if (!lead) return null;

  // Only activate when: no PropStream data, has address, Apollo returned nothing
  const hasPropertyData = lead.propertyData.length > 0;
  const hasApolloData = lead.enrichments.some((e) => e.provider === 'apollo' && (lead.phone || lead.email));
  const hasAddress = lead.city && lead.state;

  if (hasPropertyData || hasApolloData || !hasAddress) {
    return null;
  }

  const apiKey = (config as any).batchSkipTracing?.apiKey;
  if (!apiKey) {
    console.warn('[BatchSkipTracing] API key not configured');
    return null;
  }

  const result = await callExternalAPI<SkipTraceResult>(
    'batch_skip_tracing',
    'lookup',
    async () => {
      const res = await fetch('https://batchskiptracing.com/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify([{
          first_name: lead.firstName,
          last_name: lead.lastName,
          property_address: `${lead.city}, ${lead.state} ${lead.zip}`,
          city: lead.city,
          state: lead.state,
          zip: lead.zip,
        }]),
      });

      if (!res.ok) throw new Error(`BatchSkipTracing ${res.status}`);
      const data = await res.json();
      return data[0] || { phones: [], emails: [], confidence: 0 };
    },
    { organizationId },
  );

  if (!result.success) return null;

  // Store as enrichment
  await db.leadEnrichment.create({
    data: {
      leadId,
      provider: 'batchskiptracing',
      rawPayloadJson: result.data as any,
      confidenceScore: result.data.confidence,
      lastEnrichedAt: new Date(),
    },
  });

  // Update lead with found contact info
  const updates: any = {};
  if (!lead.phone && result.data.phones.length > 0) updates.phone = result.data.phones[0];
  if (!lead.email && result.data.emails.length > 0) updates.email = result.data.emails[0];
  if (Object.keys(updates).length > 0) {
    await db.lead.update({ where: { id: leadId }, data: updates });
  }

  await writeAuditLog({
    organizationId,
    entityType: 'lead_enrichment',
    entityId: leadId,
    action: 'skip_traced',
    metadata: { phones: result.data.phones.length, emails: result.data.emails.length },
  });

  return result.data;
}
