import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

export interface CreateCampaignInput {
  organizationId: string;
  name: string;
  description?: string;
  targetSegmentId?: string;
  personaMode?: string;
  objective?: string;
  approvalMode?: string;
  splitTestEnabled?: boolean;
  splitTestRatio?: number;
  rulesJson?: Record<string, unknown>;
  createdByUserId?: string;
}

export async function createCampaign(input: CreateCampaignInput) {
  const campaign = await db.campaign.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      targetSegmentId: input.targetSegmentId,
      personaMode: input.personaMode,
      objective: input.objective,
      approvalMode: input.approvalMode || 'manual',
      splitTestEnabled: input.splitTestEnabled || false,
      splitTestRatio: input.splitTestRatio,
      rulesJson: input.rulesJson ? JSON.parse(JSON.stringify(input.rulesJson)) : undefined,
      createdByUserId: input.createdByUserId,
    },
  });

  await writeAuditLog({
    organizationId: input.organizationId,
    userId: input.createdByUserId,
    entityType: 'campaign',
    entityId: campaign.id,
    action: 'created',
  });

  await emitEvent('campaign.created', { campaignId: campaign.id, organizationId: input.organizationId });

  return campaign;
}

export async function getCampaigns(organizationId: string, status?: string) {
  const where: any = { organizationId };
  if (status) where.status = status;

  return db.campaign.findMany({
    where,
    include: {
      _count: { select: { campaignLeads: true } },
      variants: true,
      targetSegment: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCampaignById(campaignId: string, organizationId: string) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: {
      campaignLeads: {
        include: { lead: { select: { id: true, fullName: true, email: true, phone: true } } },
        take: 100,
      },
      variants: true,
      targetSegment: true,
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!campaign) throw new NotFoundError('Campaign');
  return campaign;
}

export async function enrollLeadInCampaign(campaignId: string, leadId: string, organizationId: string) {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, organizationId } });
  if (!campaign) throw new NotFoundError('Campaign');

  const existing = await db.campaignLead.findUnique({
    where: { campaignId_leadId: { campaignId, leadId } },
  });
  if (existing) throw new ValidationError('Lead already enrolled in this campaign');

  // Assign variant if split test enabled
  let variant: string | null = null;
  if (campaign.splitTestEnabled) {
    const ratio = campaign.splitTestRatio || 0.5;
    variant = Math.random() < ratio ? 'A' : 'B';
  }

  const cl = await db.campaignLead.create({
    data: { campaignId, leadId, variant },
  });

  await emitEvent('campaign.lead_enrolled', { campaignId, leadId, variant });

  return cl;
}

export async function updateCampaignStatus(campaignId: string, organizationId: string, status: string, userId?: string) {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, organizationId } });
  if (!campaign) throw new NotFoundError('Campaign');

  const updated = await db.campaign.update({
    where: { id: campaignId },
    data: { status },
  });

  await writeAuditLog({
    organizationId,
    userId,
    entityType: 'campaign',
    entityId: campaignId,
    action: 'status_changed',
    metadata: { from: campaign.status, to: status },
  });

  return updated;
}
