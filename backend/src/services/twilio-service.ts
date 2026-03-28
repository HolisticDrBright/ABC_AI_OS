import { config } from '../lib/config.js';
import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { ValidationError } from '../lib/errors.js';
import crypto from 'crypto';

// ==================== TWILIO API ====================

async function twilioRequest<T>(path: string, body: URLSearchParams): Promise<T> {
  const maxRetries = 3;
  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}`;
  const auth = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`Twilio ${res.status}: ${errBody.message || 'Unknown error'}`);
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

  throw new Error('Twilio request failed after retries');
}

// ==================== WEBHOOK SIGNATURE VALIDATION ====================

export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  if (!config.twilio.authToken) return false;

  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], '');
  const data = url + sortedParams;

  const computed = crypto
    .createHmac('sha1', config.twilio.authToken)
    .update(data)
    .digest('base64');

  return computed === signature;
}

// ==================== QUIET HOURS ====================

export function isQuietHours(): boolean {
  const { quietHoursStart, quietHoursEnd } = config.compliance;
  const now = new Date();

  // Use locale-aware hour extraction for the configured timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: config.compliance.quietHoursTimezone,
  });
  const currentHour = parseInt(formatter.format(now), 10);

  const startHour = parseInt(quietHoursStart.split(':')[0], 10);
  const startMin = parseInt(quietHoursStart.split(':')[1], 10);
  const endHour = parseInt(quietHoursEnd.split(':')[0], 10);

  const minuteFormatter = new Intl.DateTimeFormat('en-US', {
    minute: 'numeric',
    timeZone: config.compliance.quietHoursTimezone,
  });
  const currentMinute = parseInt(minuteFormatter.format(now), 10);

  const currentTotal = currentHour * 60 + currentMinute;
  const startTotal = startHour * 60 + startMin;
  const endTotal = endHour * 60 + parseInt(quietHoursEnd.split(':')[1] || '0', 10);

  if (startTotal > endTotal) {
    // Overnight quiet hours (e.g. 21:00 - 08:00)
    return currentTotal >= startTotal || currentTotal < endTotal;
  }
  return currentTotal >= startTotal && currentTotal < endTotal;
}

// ==================== SEND SMS ====================

export interface TwilioSendInput {
  organizationId: string;
  leadId: string;
  campaignId?: string;
  body: string;
  aiGenerated?: boolean;
  variant?: string;
  sentByUserId?: string;
}

export async function sendSmsViaTwilio(input: TwilioSendInput) {
  // Pre-send compliance checks
  const lead = await db.lead.findUnique({
    where: { id: input.leadId },
    include: { identity: true },
  });
  if (!lead) throw new ValidationError('Lead not found');
  if (lead.doNotContact) throw new ValidationError('Lead is marked do not contact');
  if (isQuietHours()) throw new ValidationError('Cannot send during quiet hours');

  const toPhone = lead.identity?.twilioPrimaryPhone || lead.phone;
  if (!toPhone) throw new ValidationError('Lead has no phone number');

  // Create message record
  const message = await db.message.create({
    data: {
      organizationId: input.organizationId,
      leadId: input.leadId,
      campaignId: input.campaignId,
      direction: 'outbound',
      channel: 'sms',
      provider: 'twilio',
      body: input.body,
      status: 'queued',
      sentByType: input.sentByUserId ? 'user' : 'system',
      sentByUserId: input.sentByUserId,
      aiGenerated: input.aiGenerated || false,
      variant: input.variant,
    },
  });

  try {
    // Send via Twilio API
    const params = new URLSearchParams({
      To: toPhone,
      From: config.twilio.phoneNumber,
      Body: input.body,
      StatusCallback: `${process.env.BASE_URL || 'https://api.example.com'}/api/webhooks/twilio/status`,
    });

    const twilioResponse = await twilioRequest<any>('/Messages.json', params);

    // Update message with provider ID
    const updated = await db.message.update({
      where: { id: message.id },
      data: {
        providerMessageId: twilioResponse.sid,
        status: 'sent',
      },
    });

    await db.messageEvent.create({
      data: {
        messageId: message.id,
        eventType: 'sent',
        eventPayloadJson: { sid: twilioResponse.sid } as any,
        occurredAt: new Date(),
      },
    });

    await writeAuditLog({
      organizationId: input.organizationId,
      entityType: 'message',
      entityId: message.id,
      action: 'sms_sent',
      metadata: { channel: 'sms', twilioSid: twilioResponse.sid, aiGenerated: input.aiGenerated },
    });

    await emitEvent('message.sent', {
      messageId: message.id,
      leadId: input.leadId,
      campaignId: input.campaignId,
    });

    return updated;
  } catch (err: any) {
    await db.message.update({
      where: { id: message.id },
      data: { status: 'failed' },
    });

    await db.messageEvent.create({
      data: {
        messageId: message.id,
        eventType: 'failed',
        eventPayloadJson: { error: err.message } as any,
        occurredAt: new Date(),
      },
    });

    await emitEvent('message.failed', { messageId: message.id, error: err.message });
    throw err;
  }
}

// ==================== INBOUND WEBHOOK ====================

export async function processInboundWebhook(payload: {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
}) {
  // Log webhook
  await db.twilioWebhookLog.create({
    data: {
      providerMessageId: payload.MessageSid,
      webhookType: 'inbound_sms',
      payloadJson: payload as any,
      receivedAt: new Date(),
    },
  });

  const normalizedPhone = payload.From.replace(/\D/g, '');
  const identity = await db.leadIdentity.findFirst({
    where: { normalizedPhone },
    include: { lead: true },
  });

  if (!identity) {
    console.warn(`[Twilio] Inbound from unknown: ${payload.From}`);
    // Could create a new lead here for inbound routing
    return { action: 'unknown_sender' };
  }

  // STOP/opt-out detection
  const stopPatterns = ['stop', 'unsubscribe', 'quit', 'cancel', 'opt out', 'optout', 'end', 'remove'];
  const bodyLower = payload.Body.toLowerCase().trim();
  if (stopPatterns.some((w) => bodyLower === w || bodyLower.startsWith(w + ' '))) {
    await db.lead.update({
      where: { id: identity.leadId },
      data: { doNotContact: true },
    });

    await writeAuditLog({
      organizationId: identity.lead.organizationId,
      entityType: 'lead',
      entityId: identity.leadId,
      action: 'dnc_auto_flagged',
      metadata: { reason: 'STOP keyword', inboundBody: payload.Body },
    });

    return { action: 'dnc_flagged', leadId: identity.leadId };
  }

  // Store inbound message
  const message = await db.message.create({
    data: {
      organizationId: identity.lead.organizationId,
      leadId: identity.leadId,
      direction: 'inbound',
      channel: 'sms',
      provider: 'twilio',
      providerMessageId: payload.MessageSid,
      body: payload.Body,
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

  return { action: 'received', message, conversation };
}

// ==================== STATUS WEBHOOK ====================

export async function processStatusWebhook(payload: {
  MessageSid: string;
  MessageStatus: string;
  ErrorCode?: string;
}) {
  await db.twilioWebhookLog.create({
    data: {
      providerMessageId: payload.MessageSid,
      webhookType: 'status_callback',
      payloadJson: payload as any,
      receivedAt: new Date(),
    },
  });

  const message = await db.message.findFirst({
    where: { providerMessageId: payload.MessageSid },
  });

  if (!message) return;

  await db.message.update({
    where: { id: message.id },
    data: { status: payload.MessageStatus },
  });

  await db.messageEvent.create({
    data: {
      messageId: message.id,
      eventType: payload.MessageStatus,
      eventPayloadJson: payload as any,
      occurredAt: new Date(),
    },
  });

  if (payload.MessageStatus === 'delivered') {
    await emitEvent('message.delivered', { messageId: message.id, leadId: message.leadId });
  } else if (payload.MessageStatus === 'failed' || payload.MessageStatus === 'undelivered') {
    await emitEvent('message.failed', { messageId: message.id, error: payload.ErrorCode });
  }
}
