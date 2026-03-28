import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { config } from '../lib/config.js';
import { ValidationError } from '../lib/errors.js';

export interface SendMessageInput {
  organizationId: string;
  leadId: string;
  campaignId?: string;
  body: string;
  aiGenerated?: boolean;
  variant?: string;
  sentByUserId?: string;
}

function isQuietHours(): boolean {
  const { quietHoursStart, quietHoursEnd, quietHoursTimezone } = config.compliance;
  const now = new Date();
  // Simple hour-based check — production should use proper timezone lib
  const hour = now.getHours();
  const startHour = parseInt(quietHoursStart.split(':')[0], 10);
  const endHour = parseInt(quietHoursEnd.split(':')[0], 10);

  if (startHour > endHour) {
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

export async function sendSms(input: SendMessageInput) {
  // Compliance checks
  const lead = await db.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new ValidationError('Lead not found');
  if (lead.doNotContact) throw new ValidationError('Lead is marked do not contact');
  if (isQuietHours()) throw new ValidationError('Cannot send during quiet hours');

  const message = await db.message.create({
    data: {
      organizationId: input.organizationId,
      leadId: input.leadId,
      campaignId: input.campaignId,
      direction: 'outbound',
      channel: 'sms',
      provider: 'twilio',
      body: input.body,
      status: 'pending',
      sentByType: input.sentByUserId ? 'user' : 'system',
      sentByUserId: input.sentByUserId,
      aiGenerated: input.aiGenerated || false,
      variant: input.variant,
    },
  });

  // TODO: Actual Twilio API call
  // For now, mark as sent and emit event
  const updated = await db.message.update({
    where: { id: message.id },
    data: { status: 'sent' },
  });

  await writeAuditLog({
    organizationId: input.organizationId,
    entityType: 'message',
    entityId: message.id,
    action: 'sent',
    metadata: { channel: 'sms', aiGenerated: input.aiGenerated },
  });

  await emitEvent('message.sent', {
    messageId: message.id,
    leadId: input.leadId,
    campaignId: input.campaignId,
  });

  return updated;
}

export async function getConversationMessages(leadId: string, organizationId: string) {
  return db.message.findMany({
    where: { leadId, organizationId },
    orderBy: { createdAt: 'asc' },
    include: {
      events: true,
      sentBy: { select: { id: true, name: true } },
    },
  });
}

export async function processInboundSms(payload: {
  from: string;
  to: string;
  body: string;
  providerMessageId: string;
}) {
  // Log webhook
  await db.twilioWebhookLog.create({
    data: {
      providerMessageId: payload.providerMessageId,
      webhookType: 'inbound_sms',
      payloadJson: payload as any,
      receivedAt: new Date(),
    },
  });

  // Find lead by phone
  const normalizedPhone = payload.from.replace(/\D/g, '');
  const identity = await db.leadIdentity.findFirst({
    where: { normalizedPhone },
    include: { lead: true },
  });

  if (!identity) {
    console.warn(`[Messaging] Inbound SMS from unknown number: ${payload.from}`);
    return null;
  }

  // Check for STOP/opt-out
  const stopWords = ['stop', 'unsubscribe', 'quit', 'cancel', 'opt out', 'optout'];
  if (stopWords.some((w) => payload.body.toLowerCase().trim().includes(w))) {
    await db.lead.update({
      where: { id: identity.leadId },
      data: { doNotContact: true },
    });
    await writeAuditLog({
      organizationId: identity.lead.organizationId,
      entityType: 'lead',
      entityId: identity.leadId,
      action: 'dnc_auto_flagged',
      metadata: { reason: 'STOP keyword detected', message: payload.body },
    });
    return { action: 'dnc_flagged', leadId: identity.leadId };
  }

  const message = await db.message.create({
    data: {
      organizationId: identity.lead.organizationId,
      leadId: identity.leadId,
      direction: 'inbound',
      channel: 'sms',
      provider: 'twilio',
      providerMessageId: payload.providerMessageId,
      body: payload.body,
      status: 'received',
    },
  });

  // Upsert conversation
  const conversation = await db.conversation.upsert({
    where: { leadId_channel: { leadId: identity.leadId, channel: 'sms' } },
    update: { lastMessageAt: new Date(), threadStatus: 'open' },
    create: {
      organizationId: identity.lead.organizationId,
      leadId: identity.leadId,
      channel: 'sms',
      lastMessageAt: new Date(),
    },
  });

  await emitEvent('inbound.reply_received', {
    messageId: message.id,
    leadId: identity.leadId,
    conversationId: conversation.id,
    organizationId: identity.lead.organizationId,
  });

  return { message, conversation };
}
