import { config } from '../lib/config.js';
import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { NotFoundError } from '../lib/errors.js';

const FUB_BASE = 'https://api.followupboss.com/v1';

async function fubRequest<T>(path: string, method = 'GET', body?: any): Promise<T> {
  const maxRetries = 3;
  const auth = Buffer.from(`${config.followUpBoss.apiKey}:`).toString('base64');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`${FUB_BASE}${path}`, {
        method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`FUB ${res.status}: ${errBody}`);
      }

      return await res.json() as T;
    } catch (err: any) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw err;
    }
  }

  throw new Error('FUB request failed after retries');
}

// ==================== PUSH LEAD TO FUB ====================

export async function syncLeadToFUB(leadId: string, organizationId: string, userId?: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId },
    include: {
      identity: true,
      scores: { take: 1, orderBy: { scoredAt: 'desc' } },
    },
  });
  if (!lead) throw new NotFoundError('Lead');

  const requestPayload = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    emails: lead.email ? [{ value: lead.email }] : [],
    phones: lead.phone ? [{ value: lead.phone }] : [],
    source: lead.sourceLabel || 'ABC AI OS',
    tags: ['abc-ai-os'],
    ...(lead.city && { addresses: [{ city: lead.city, state: lead.state, code: lead.zip }] }),
  };

  const syncLog = await db.followupbossSyncLog.create({
    data: {
      leadId,
      operationType: lead.identity?.followupbossPersonId ? 'update_person' : 'create_person',
      requestPayloadJson: requestPayload as any,
      status: 'pending',
      syncedAt: new Date(),
    },
  });

  try {
    let fubPerson: any;

    if (lead.identity?.followupbossPersonId) {
      // Update existing
      fubPerson = await fubRequest<any>(
        `/people/${lead.identity.followupbossPersonId}`,
        'PUT',
        requestPayload,
      );
    } else {
      // Create new — handle 409 Conflict (person already exists) as update
      try {
        fubPerson = await fubRequest<any>('/people', 'POST', requestPayload);
      } catch (err: any) {
        if (err.message?.includes('409')) {
          // Person exists in FUB — search by email to get ID, then update
          const searchResult = await fubRequest<any>(`/people?emails[]=${encodeURIComponent(lead.email || '')}`);
          const existing = searchResult?.people?.[0];
          if (existing) {
            fubPerson = await fubRequest<any>(`/people/${existing.id}`, 'PUT', requestPayload);
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    // Store FUB person ID
    await db.leadIdentity.upsert({
      where: { leadId },
      update: { followupbossPersonId: String(fubPerson.id) },
      create: {
        leadId,
        followupbossPersonId: String(fubPerson.id),
        normalizedEmail: lead.email?.toLowerCase(),
        normalizedPhone: lead.phone?.replace(/\D/g, ''),
      },
    });

    await db.followupbossSyncLog.update({
      where: { id: syncLog.id },
      data: { status: 'success', responsePayloadJson: { personId: fubPerson.id } as any },
    });

    await writeAuditLog({
      organizationId,
      userId,
      entityType: 'fub_sync',
      entityId: leadId,
      action: 'lead_synced',
      metadata: { fubPersonId: fubPerson.id },
    });

    await emitEvent('followupboss.synced', { leadId, fubPersonId: fubPerson.id });

    return fubPerson;
  } catch (err: any) {
    await db.followupbossSyncLog.update({
      where: { id: syncLog.id },
      data: { status: 'error', errorMessage: err.message },
    });
    throw err;
  }
}

// ==================== PUSH NOTE ====================

export async function pushNoteToFUB(leadId: string, organizationId: string, note: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId },
    include: { identity: true },
  });
  if (!lead?.identity?.followupbossPersonId) {
    throw new ValidationError('Lead not synced to FUB yet');
  }

  // Prefix all AI-generated notes so agents can distinguish them
  const prefixedNote = `[ABC AI OS] ${note}`;

  const result = await fubRequest<any>('/notes', 'POST', {
    personId: parseInt(lead.identity.followupbossPersonId),
    body: prefixedNote,
    subject: '[ABC AI OS] Note',
  });

  await db.followupbossSyncLog.create({
    data: {
      leadId,
      operationType: 'create_note',
      requestPayloadJson: { note: note.substring(0, 200) } as any,
      responsePayloadJson: { noteId: result.id } as any,
      status: 'success',
      syncedAt: new Date(),
    },
  });

  return result;
}

// ==================== PUSH TASK ====================

export async function pushTaskToFUB(
  leadId: string,
  organizationId: string,
  task: { name: string; description?: string; dueAt?: string },
) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId },
    include: { identity: true },
  });
  if (!lead?.identity?.followupbossPersonId) {
    throw new ValidationError('Lead not synced to FUB yet');
  }

  const result = await fubRequest<any>('/tasks', 'POST', {
    personId: parseInt(lead.identity.followupbossPersonId),
    name: task.name,
    description: task.description,
    dueDate: task.dueAt,
  });

  await db.followupbossSyncLog.create({
    data: {
      leadId,
      operationType: 'create_task',
      requestPayloadJson: task as any,
      responsePayloadJson: { taskId: result.id } as any,
      status: 'success',
      syncedAt: new Date(),
    },
  });

  return result;
}

// ==================== PUSH EVENT ====================

export async function pushEventToFUB(
  leadId: string,
  organizationId: string,
  event: { type: string; message: string },
) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId },
    include: { identity: true },
  });
  if (!lead?.identity?.followupbossPersonId) return;

  try {
    const result = await fubRequest<any>('/events', 'POST', {
      personId: parseInt(lead.identity.followupbossPersonId),
      source: 'ABC AI OS',
      type: event.type,
      message: event.message,
    });

    await db.followupbossSyncLog.create({
      data: {
        leadId,
        operationType: 'create_event',
        requestPayloadJson: event as any,
        responsePayloadJson: { eventId: result.id } as any,
        status: 'success',
        syncedAt: new Date(),
      },
    });
  } catch (err: any) {
    await db.followupbossSyncLog.create({
      data: {
        leadId,
        operationType: 'create_event',
        requestPayloadJson: event as any,
        status: 'error',
        errorMessage: err.message,
        syncedAt: new Date(),
      },
    });
  }
}

// ==================== IMPORT STALE LEADS FROM FUB ====================

export async function importStaleLeadsFromFUB(organizationId: string, userId?: string) {
  // Fetch people with "stale" or old last activity
  const result = await fubRequest<any>('/people?sort=lastActivity&limit=100');
  const people = result.people || [];
  const imported = [];

  for (const person of people) {
    const email = person.emails?.[0]?.value;
    if (email) {
      const existing = await db.lead.findFirst({ where: { organizationId, email } });
      if (existing) {
        imported.push({ action: 'skipped_duplicate', email });
        continue;
      }
    }

    const lead = await db.lead.create({
      data: {
        organizationId,
        firstName: person.firstName,
        lastName: person.lastName,
        fullName: [person.firstName, person.lastName].filter(Boolean).join(' '),
        email,
        phone: person.phones?.[0]?.value,
        sourceLabel: 'followupboss_import',
        externalSourceType: 'followupboss',
        externalSourceId: String(person.id),
        leadStatus: 'new',
        ownerUserId: userId,
      },
    });

    await db.leadIdentity.create({
      data: {
        leadId: lead.id,
        followupbossPersonId: String(person.id),
        normalizedEmail: email?.toLowerCase(),
        normalizedPhone: person.phones?.[0]?.value?.replace(/\D/g, ''),
      },
    });

    await emitEvent('lead.created', { leadId: lead.id, organizationId });
    imported.push({ action: 'created', leadId: lead.id });
  }

  await writeAuditLog({
    organizationId,
    userId,
    entityType: 'fub_import',
    action: 'stale_leads_imported',
    metadata: { total: people.length, created: imported.filter((i) => i.action === 'created').length },
  });

  return imported;
}

// ==================== FUB WEBHOOK HANDLER ====================

export async function handleFUBWebhook(payload: any) {
  const eventType = payload.event;
  const personId = payload.person?.id;

  if (!personId) return;

  // Find lead by FUB person ID
  const identity = await db.leadIdentity.findFirst({
    where: { followupbossPersonId: String(personId) },
    include: { lead: true },
  });

  if (!identity) return;

  if (eventType === 'peopleUpdated' || eventType === 'peopleCreated') {
    const person = payload.person;
    await db.lead.update({
      where: { id: identity.leadId },
      data: {
        firstName: person.firstName || identity.lead.firstName,
        lastName: person.lastName || identity.lead.lastName,
        fullName: [person.firstName, person.lastName].filter(Boolean).join(' ') || identity.lead.fullName,
        email: person.emails?.[0]?.value || identity.lead.email,
        phone: person.phones?.[0]?.value || identity.lead.phone,
      },
    });

    await emitEvent('lead.updated', { leadId: identity.leadId, source: 'fub_webhook' });
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
