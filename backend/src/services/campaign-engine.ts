import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

// ==================== CAMPAIGN SEQUENCE ENGINE ====================

export async function progressSequence(campaignLeadId: string) {
  const cl = await db.campaignLead.findUnique({
    where: { id: campaignLeadId },
    include: {
      campaign: { include: { variants: true } },
      lead: true,
    },
  });

  if (!cl) throw new NotFoundError('CampaignLead');
  if (cl.status !== 'active') return null;

  const rules = cl.campaign.rulesJson as any;
  const maxSteps = rules?.maxSteps || 5;
  const delayHours = rules?.delayBetweenSteps || 24;

  // Check if past max steps
  if (cl.currentStep >= maxSteps) {
    await db.campaignLead.update({
      where: { id: campaignLeadId },
      data: { status: 'completed', exitedAt: new Date() },
    });
    return { action: 'completed', reason: 'Max steps reached' };
  }

  // Check stop conditions
  if (cl.lead.doNotContact) {
    await db.campaignLead.update({
      where: { id: campaignLeadId },
      data: { status: 'stopped', exitedAt: new Date() },
    });
    return { action: 'stopped', reason: 'Lead marked DNC' };
  }

  // Check if lead replied (auto-exit or branch)
  const hasReply = await db.message.findFirst({
    where: {
      leadId: cl.leadId,
      campaignId: cl.campaignId,
      direction: 'inbound',
    },
  });

  if (hasReply && rules?.exitOnReply !== false) {
    await db.campaignLead.update({
      where: { id: campaignLeadId },
      data: { status: 'replied', exitedAt: new Date() },
    });
    return { action: 'exited', reason: 'Lead replied' };
  }

  // Advance step
  const nextStep = cl.currentStep + 1;
  await db.campaignLead.update({
    where: { id: campaignLeadId },
    data: { currentStep: nextStep },
  });

  return { action: 'advanced', step: nextStep, leadId: cl.leadId, campaignId: cl.campaignId };
}

// ==================== BULK ENROLLMENT ====================

export async function bulkEnrollLeads(
  campaignId: string,
  leadIds: string[],
  organizationId: string,
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId },
  });
  if (!campaign) throw new NotFoundError('Campaign');

  const results = [];
  for (const leadId of leadIds) {
    const existing = await db.campaignLead.findUnique({
      where: { campaignId_leadId: { campaignId, leadId } },
    });
    if (existing) {
      results.push({ leadId, action: 'skipped_already_enrolled' });
      continue;
    }

    // Check DNC
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (lead?.doNotContact) {
      results.push({ leadId, action: 'skipped_dnc' });
      continue;
    }

    let variant: string | null = null;
    if (campaign.splitTestEnabled) {
      const ratio = campaign.splitTestRatio || 0.5;
      variant = Math.random() < ratio ? 'A' : 'B';
    }

    await db.campaignLead.create({
      data: { campaignId, leadId, variant },
    });

    await emitEvent('campaign.lead_enrolled', { campaignId, leadId, variant });
    if (variant) {
      await emitEvent('campaign.variant_assigned', { campaignId, leadId, variant });
    }

    results.push({ leadId, action: 'enrolled', variant });
  }

  await writeAuditLog({
    organizationId,
    entityType: 'campaign',
    entityId: campaignId,
    action: 'bulk_enrollment',
    metadata: {
      total: leadIds.length,
      enrolled: results.filter((r) => r.action === 'enrolled').length,
    },
  });

  return results;
}

// ==================== VARIANT MANAGEMENT ====================

export async function createVariant(
  campaignId: string,
  organizationId: string,
  data: { variantLabel: string; promptTemplate?: string; angle?: string; personaMode?: string },
) {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, organizationId } });
  if (!campaign) throw new NotFoundError('Campaign');

  return db.campaignVariant.create({
    data: {
      campaignId,
      variantLabel: data.variantLabel,
      promptTemplate: data.promptTemplate,
      angle: data.angle,
      personaMode: data.personaMode,
    },
  });
}

export async function updateVariantMetrics(campaignId: string) {
  const variants = await db.campaignVariant.findMany({ where: { campaignId } });

  for (const variant of variants) {
    const messages = await db.message.findMany({
      where: { campaignId, variant: variant.variantLabel, direction: 'outbound' },
    });
    const sentCount = messages.length;

    const replies = await db.message.count({
      where: { campaignId, direction: 'inbound' },
    });

    // Simple reply rate calculation
    const replyRate = sentCount > 0 ? (replies / sentCount) * 100 : null;

    await db.campaignVariant.update({
      where: { id: variant.id },
      data: {
        messageCount: sentCount,
        replyRate,
      },
    });
  }
}
