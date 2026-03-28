import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { NotFoundError } from '../lib/errors.js';

export interface CreateLeadInput {
  organizationId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  city?: string;
  state?: string;
  zip?: string;
  sourceLabel?: string;
  externalSourceType?: string;
  externalSourceId?: string;
  inboundSource?: string;
  ownerUserId?: string;
}

export interface LeadFilters {
  organizationId: string;
  search?: string;
  leadStatus?: string;
  sourceLabel?: string;
  ownerUserId?: string;
  minScore?: number;
  maxScore?: number;
  page?: number;
  limit?: number;
}

export async function createLead(input: CreateLeadInput, userId?: string) {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ') || null;

  const lead = await db.lead.create({
    data: {
      organizationId: input.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName,
      email: input.email,
      phone: input.phone,
      company: input.company,
      title: input.title,
      city: input.city,
      state: input.state,
      zip: input.zip,
      sourceLabel: input.sourceLabel,
      externalSourceType: input.externalSourceType,
      externalSourceId: input.externalSourceId,
      inboundSource: input.inboundSource,
      ownerUserId: input.ownerUserId,
      inboundReceivedAt: input.inboundSource ? new Date() : undefined,
    },
  });

  // Create identity record
  await db.leadIdentity.create({
    data: {
      leadId: lead.id,
      normalizedEmail: input.email?.toLowerCase().trim(),
      normalizedPhone: input.phone?.replace(/\D/g, ''),
    },
  });

  await writeAuditLog({
    organizationId: input.organizationId,
    userId,
    entityType: 'lead',
    entityId: lead.id,
    action: 'created',
    metadata: { source: input.sourceLabel },
  });

  await emitEvent('lead.created', { leadId: lead.id, organizationId: input.organizationId });

  return lead;
}

export async function getLeads(filters: LeadFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const where: any = { organizationId: filters.organizationId };

  if (filters.leadStatus) where.leadStatus = filters.leadStatus;
  if (filters.sourceLabel) where.sourceLabel = filters.sourceLabel;
  if (filters.ownerUserId) where.ownerUserId = filters.ownerUserId;
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
      { company: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [leads, total] = await Promise.all([
    db.lead.findMany({
      where,
      include: {
        scores: { orderBy: { scoredAt: 'desc' }, take: 1 },
        owner: { select: { id: true, name: true } },
        leadSegments: { include: { segment: { select: { id: true, name: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    db.lead.count({ where }),
  ]);

  return { leads, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getLeadById(leadId: string, organizationId: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId },
    include: {
      identity: true,
      scores: { orderBy: { scoredAt: 'desc' }, take: 5 },
      enrichments: { orderBy: { lastEnrichedAt: 'desc' }, take: 1 },
      personaMemories: { orderBy: { createdAt: 'desc' }, take: 10 },
      leadSegments: { include: { segment: true } },
      campaignLeads: { include: { campaign: { select: { id: true, name: true, status: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 50 },
      conversations: { orderBy: { lastMessageAt: 'desc' }, take: 5 },
      tasks: { orderBy: { createdAt: 'desc' }, take: 10 },
      openclawJobs: { orderBy: { createdAt: 'desc' }, take: 5 },
      aiDecisions: { orderBy: { createdAt: 'desc' }, take: 10 },
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  if (!lead) throw new NotFoundError('Lead');
  return lead;
}

export async function updateLead(leadId: string, organizationId: string, data: Partial<CreateLeadInput>, userId?: string) {
  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) throw new NotFoundError('Lead');

  const fullName = data.firstName || data.lastName
    ? [data.firstName ?? lead.firstName, data.lastName ?? lead.lastName].filter(Boolean).join(' ')
    : undefined;

  const updated = await db.lead.update({
    where: { id: leadId },
    data: {
      ...data,
      fullName,
    },
  });

  await writeAuditLog({
    organizationId,
    userId,
    entityType: 'lead',
    entityId: leadId,
    action: 'updated',
    metadata: { fields: Object.keys(data) },
  });

  await emitEvent('lead.updated', { leadId, organizationId });

  return updated;
}

export async function bulkCreateLeads(leads: CreateLeadInput[], userId?: string) {
  const results = [];
  for (const input of leads) {
    // Simple dedupe by email or phone within org
    if (input.email) {
      const existing = await db.lead.findFirst({
        where: { organizationId: input.organizationId, email: input.email },
      });
      if (existing) {
        results.push({ lead: existing, action: 'skipped_duplicate' });
        continue;
      }
    }
    const lead = await createLead(input, userId);
    results.push({ lead, action: 'created' });
  }
  return results;
}
