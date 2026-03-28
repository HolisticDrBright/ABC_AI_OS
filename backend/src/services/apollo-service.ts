import { config } from '../lib/config.js';
import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { NotFoundError } from '../lib/errors.js';

const APOLLO_BASE = 'https://api.apollo.io/v1';

async function apolloRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`${APOLLO_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': config.apollo.apiKey,
          ...(options.headers || {}),
        },
      });

      if (res.status === 429) {
        // Rate limited — exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Apollo API ${res.status}: ${body}`);
      }

      return await res.json();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('Apollo API request failed');
}

export interface ApolloSearchParams {
  q_keywords?: string;
  person_titles?: string[];
  person_locations?: string[];
  per_page?: number;
  page?: number;
}

export async function searchPeople(params: ApolloSearchParams) {
  const result = await apolloRequest<any>('/mixed_people/search', {
    method: 'POST',
    body: JSON.stringify({
      q_keywords: params.q_keywords,
      person_titles: params.person_titles,
      person_locations: params.person_locations,
      per_page: params.per_page || 25,
      page: params.page || 1,
    }),
  });

  return {
    people: result.people || [],
    total: result.pagination?.total_entries || 0,
    page: result.pagination?.page || 1,
    totalPages: result.pagination?.total_pages || 1,
  };
}

export async function enrichPerson(params: { email?: string; firstName?: string; lastName?: string; domain?: string }) {
  const result = await apolloRequest<any>('/people/match', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
      domain: params.domain,
    }),
  });

  return result.person || null;
}

export async function importAndEnrichLead(
  leadId: string,
  organizationId: string,
  userId?: string,
) {
  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) throw new NotFoundError('Lead');

  // Log the sync attempt
  const syncLog = await db.apolloSyncLog.create({
    data: {
      leadId,
      operationType: 'enrich',
      requestPayloadJson: { email: lead.email, firstName: lead.firstName, lastName: lead.lastName } as any,
      status: 'pending',
      syncedAt: new Date(),
    },
  });

  try {
    const person = await enrichPerson({
      email: lead.email || undefined,
      firstName: lead.firstName || undefined,
      lastName: lead.lastName || undefined,
    });

    if (!person) {
      await db.apolloSyncLog.update({
        where: { id: syncLog.id },
        data: { status: 'no_match', responsePayloadJson: {} as any },
      });
      return null;
    }

    // Store enrichment
    const enrichment = await db.leadEnrichment.create({
      data: {
        leadId,
        provider: 'apollo',
        rawPayloadJson: person as any,
        enrichmentVersion: '1',
        confidenceScore: person.email_status === 'verified' ? 0.95 : 0.7,
        lastEnrichedAt: new Date(),
      },
    });

    // Update lead identity with Apollo contact ID
    await db.leadIdentity.upsert({
      where: { leadId },
      update: { apolloContactId: person.id },
      create: {
        leadId,
        apolloContactId: person.id,
        normalizedEmail: lead.email?.toLowerCase(),
        normalizedPhone: lead.phone?.replace(/\D/g, ''),
      },
    });

    // Update lead fields from enrichment if missing
    const updates: Record<string, any> = {};
    if (!lead.company && person.organization?.name) updates.company = person.organization.name;
    if (!lead.title && person.title) updates.title = person.title;
    if (!lead.city && person.city) updates.city = person.city;
    if (!lead.state && person.state) updates.state = person.state;
    if (!lead.phone && person.phone_numbers?.[0]?.sanitized_number) {
      updates.phone = person.phone_numbers[0].sanitized_number;
    }

    if (Object.keys(updates).length > 0) {
      await db.lead.update({ where: { id: leadId }, data: updates });
    }

    // Update sync log
    await db.apolloSyncLog.update({
      where: { id: syncLog.id },
      data: { status: 'success', responsePayloadJson: { personId: person.id } as any },
    });

    await writeAuditLog({
      organizationId,
      userId,
      entityType: 'lead_enrichment',
      entityId: enrichment.id,
      action: 'enriched',
      metadata: { provider: 'apollo', apolloId: person.id },
    });

    await emitEvent('lead.enriched', { leadId, enrichmentId: enrichment.id, organizationId });

    return enrichment;
  } catch (err: any) {
    await db.apolloSyncLog.update({
      where: { id: syncLog.id },
      data: { status: 'error', errorMessage: err.message },
    });
    throw err;
  }
}

export async function bulkSearchAndImport(
  organizationId: string,
  searchParams: ApolloSearchParams,
  userId?: string,
) {
  const result = await searchPeople(searchParams);
  const imported = [];

  for (const person of result.people) {
    // Dedupe by email
    if (person.email) {
      const existing = await db.lead.findFirst({
        where: { organizationId, email: person.email },
      });
      if (existing) {
        imported.push({ lead: existing, action: 'skipped_duplicate' });
        continue;
      }
    }

    const lead = await db.lead.create({
      data: {
        organizationId,
        firstName: person.first_name,
        lastName: person.last_name,
        fullName: person.name,
        email: person.email,
        phone: person.phone_numbers?.[0]?.sanitized_number,
        company: person.organization?.name,
        title: person.title,
        city: person.city,
        state: person.state,
        sourceLabel: 'apollo',
        externalSourceType: 'apollo',
        externalSourceId: person.id,
        ownerUserId: userId,
      },
    });

    await db.leadIdentity.create({
      data: {
        leadId: lead.id,
        apolloContactId: person.id,
        normalizedEmail: person.email?.toLowerCase(),
        normalizedPhone: person.phone_numbers?.[0]?.sanitized_number?.replace(/\D/g, ''),
      },
    });

    // Store raw enrichment data
    await db.leadEnrichment.create({
      data: {
        leadId: lead.id,
        provider: 'apollo',
        rawPayloadJson: person as any,
        enrichmentVersion: '1',
        confidenceScore: person.email_status === 'verified' ? 0.95 : 0.7,
        lastEnrichedAt: new Date(),
      },
    });

    await emitEvent('lead.created', { leadId: lead.id, organizationId });
    imported.push({ lead, action: 'created' });
  }

  await writeAuditLog({
    organizationId,
    userId,
    entityType: 'apollo_import',
    action: 'bulk_import',
    metadata: { totalSearched: result.total, imported: imported.filter((i) => i.action === 'created').length },
  });

  return { imported, total: result.total, page: result.page, totalPages: result.totalPages };
}
