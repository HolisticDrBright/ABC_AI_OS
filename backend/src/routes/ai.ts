import { Hono } from 'hono';
import { z } from 'zod';
import * as aiEngine from '../services/ai-engine.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const ai = new Hono();
ai.use('*', authMiddleware);

// Score a lead with AI
ai.post('/score/:leadId', async (c) => {
  const user = getUser(c);
  const body = await c.req.json().catch(() => ({}));
  const score = await aiEngine.scoreLeadWithAI(
    c.req.param('leadId'),
    user.organizationId,
    body.triggerEvent || 'manual',
  );
  return c.json(score);
});

// Generate message
ai.post('/generate-message', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const params = z.object({
    leadId: z.string(),
    personaMode: z.string().optional(),
    angle: z.string().optional(),
    campaignObjective: z.string().optional(),
    sequenceStage: z.number().optional(),
  }).parse(body);

  const result = await aiEngine.generateMessage({
    ...params,
    organizationId: user.organizationId,
  });
  return c.json(result);
});

// Classify a reply
ai.post('/classify', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const params = z.object({
    messageId: z.string(),
    conversationId: z.string(),
  }).parse(body);

  const result = await aiEngine.classifyReply({
    ...params,
    organizationId: user.organizationId,
  });
  return c.json(result);
});

// Compute NBA
ai.post('/nba/:leadId', async (c) => {
  const user = getUser(c);
  const result = await aiEngine.computeNBA(c.req.param('leadId'), user.organizationId);
  return c.json(result);
});

export default ai;
