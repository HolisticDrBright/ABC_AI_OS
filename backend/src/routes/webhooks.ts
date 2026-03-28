import { Hono } from 'hono';
import * as twilioService from '../services/twilio-service.js';
import * as fubService from '../services/followupboss-service.js';

const webhooks = new Hono();

// ==================== TWILIO INBOUND SMS ====================

webhooks.post('/twilio/inbound', async (c) => {
  // Validate Twilio signature
  const signature = c.req.header('X-Twilio-Signature') || '';
  const url = `${c.req.header('X-Forwarded-Proto') || 'https'}://${c.req.header('Host')}${c.req.path}`;
  const body = await c.req.parseBody();

  const params: Record<string, string> = {};
  for (const [key, val] of Object.entries(body)) {
    if (typeof val === 'string') params[key] = val;
  }

  if (signature && !twilioService.validateTwilioSignature(url, params, signature)) {
    return c.json({ error: 'Invalid signature' }, 403);
  }

  const result = await twilioService.processInboundWebhook({
    From: params.From || '',
    To: params.To || '',
    Body: params.Body || '',
    MessageSid: params.MessageSid || '',
  });

  return c.text('<Response></Response>', 200, { 'Content-Type': 'text/xml' });
});

// ==================== TWILIO STATUS CALLBACK ====================

webhooks.post('/twilio/status', async (c) => {
  const body = await c.req.parseBody();
  const params: Record<string, string> = {};
  for (const [key, val] of Object.entries(body)) {
    if (typeof val === 'string') params[key] = val;
  }

  await twilioService.processStatusWebhook({
    MessageSid: params.MessageSid || '',
    MessageStatus: params.MessageStatus || '',
    ErrorCode: params.ErrorCode,
  });

  return c.text('<Response></Response>', 200, { 'Content-Type': 'text/xml' });
});

// ==================== FOLLOW UP BOSS WEBHOOK ====================

webhooks.post('/followupboss', async (c) => {
  const body = await c.req.json();
  await fubService.handleFUBWebhook(body);
  return c.json({ ok: true });
});

export default webhooks;
