import { Hono } from 'hono';
import { z } from 'zod';
import * as messagingService from '../services/messaging-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const messages = new Hono();

// Authenticated routes
const authed = new Hono();
authed.use('*', authMiddleware);

authed.post('/send', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const input = z.object({
    leadId: z.string(),
    body: z.string().min(1),
    campaignId: z.string().optional(),
    aiGenerated: z.boolean().optional(),
    variant: z.string().optional(),
  }).parse(body);

  const message = await messagingService.sendSms({
    organizationId: user.organizationId,
    leadId: input.leadId,
    body: input.body,
    campaignId: input.campaignId,
    aiGenerated: input.aiGenerated,
    variant: input.variant,
    sentByUserId: user.id,
  });
  return c.json(message);
});

authed.get('/conversation/:leadId', async (c) => {
  const user = getUser(c);
  const result = await messagingService.getConversationMessages(c.req.param('leadId'), user.organizationId);
  return c.json(result);
});

messages.route('/', authed);

// Twilio webhook (unauthenticated — validated by signature)
messages.post('/webhook/twilio/inbound', async (c) => {
  // TODO: Validate Twilio webhook signature
  const body = await c.req.parseBody();
  const result = await messagingService.processInboundSms({
    from: body.From as string,
    to: body.To as string,
    body: body.Body as string,
    providerMessageId: body.MessageSid as string,
  });
  return c.text('<Response></Response>', 200, { 'Content-Type': 'text/xml' });
});

export default messages;
