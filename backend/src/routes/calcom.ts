import { Hono } from 'hono';
import { handleCalcomWebhook, generateBookingUrl } from '../services/calcom-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { config } from '../lib/config.js';
import crypto from 'crypto';

const calcom = new Hono();

// Webhook (unauthenticated — validated by signature)
calcom.post('/webhook', async (c) => {
  const signature = c.req.header('X-Cal-Signature-256') || '';
  const webhookSecret = (config as any).calcom?.webhookSecret;

  if (webhookSecret && signature) {
    const rawBody = await c.req.text();
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (signature !== expected) {
      return c.json({ error: 'Invalid signature' }, 403);
    }
    const payload = JSON.parse(rawBody);
    await handleCalcomWebhook(payload);
  } else {
    const payload = await c.req.json();
    await handleCalcomWebhook(payload);
  }

  return c.json({ ok: true });
});

// Generate booking URL (authenticated)
const authed = new Hono();
authed.use('*', authMiddleware);

authed.get('/booking-url', async (c) => {
  const query = c.req.query();
  const url = generateBookingUrl(query.agentSlug || 'default', {
    name: query.leadName,
    email: query.leadEmail,
  });
  return c.json({ url });
});

calcom.route('/', authed);

export default calcom;
