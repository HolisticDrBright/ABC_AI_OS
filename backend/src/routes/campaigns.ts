import { Hono } from 'hono';
import { z } from 'zod';
import * as campaignsService from '../services/campaigns-service.js';
import * as analyticsService from '../services/analytics-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const campaigns = new Hono();
campaigns.use('*', authMiddleware);

const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetSegmentId: z.string().optional(),
  personaMode: z.string().optional(),
  objective: z.string().optional(),
  approvalMode: z.enum(['manual', 'auto']).optional(),
  splitTestEnabled: z.boolean().optional(),
  splitTestRatio: z.number().min(0).max(1).optional(),
  rulesJson: z.record(z.unknown()).optional(),
});

campaigns.get('/', async (c) => {
  const user = getUser(c);
  const status = c.req.query('status');
  const result = await campaignsService.getCampaigns(user.organizationId, status);
  return c.json(result);
});

campaigns.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const input = createCampaignSchema.parse(body);
  const campaign = await campaignsService.createCampaign({
    ...input,
    organizationId: user.organizationId,
    createdByUserId: user.id,
  });
  return c.json(campaign, 201);
});

campaigns.get('/:id', async (c) => {
  const user = getUser(c);
  const campaign = await campaignsService.getCampaignById(c.req.param('id'), user.organizationId);
  return c.json(campaign);
});

campaigns.post('/:id/enroll', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const { leadId } = z.object({ leadId: z.string() }).parse(body);
  const result = await campaignsService.enrollLeadInCampaign(c.req.param('id'), leadId, user.organizationId);
  return c.json(result);
});

campaigns.patch('/:id/status', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const { status } = z.object({ status: z.string() }).parse(body);
  const result = await campaignsService.updateCampaignStatus(c.req.param('id'), user.organizationId, status, user.id);
  return c.json(result);
});

campaigns.get('/:id/analytics', async (c) => {
  const user = getUser(c);
  const result = await analyticsService.getCampaignAnalytics(c.req.param('id'));
  return c.json(result);
});

export default campaigns;
