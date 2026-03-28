import { Hono } from 'hono';
import { z } from 'zod';
import * as openclawService from '../services/openclaw-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const openclaw = new Hono();
openclaw.use('*', authMiddleware);

openclaw.post('/run', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const params = z.object({
    leadId: z.string(),
    workflowType: z.enum(['deep_lead_research', 'personalized_followup_plan', 'hot_lead_call_brief']),
  }).parse(body);

  const result = await openclawService.runWorkflow({
    ...params,
    organizationId: user.organizationId,
    userId: user.id,
  });
  return c.json(result);
});

openclaw.get('/jobs', async (c) => {
  const user = getUser(c);
  const status = c.req.query('status');
  const jobs = await openclawService.getJobs(user.organizationId, status);
  return c.json(jobs);
});

export default openclaw;
