import { Hono } from 'hono';
import { z } from 'zod';
import * as leadsService from '../services/leads-service.js';
import * as scoringService from '../services/scoring-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const leads = new Hono();
leads.use('*', authMiddleware);

const createLeadSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  sourceLabel: z.string().optional(),
  externalSourceType: z.string().optional(),
  externalSourceId: z.string().optional(),
  inboundSource: z.string().optional(),
  ownerUserId: z.string().optional(),
});

leads.get('/', async (c) => {
  const user = getUser(c);
  const query = c.req.query();
  const result = await leadsService.getLeads({
    organizationId: user.organizationId,
    search: query.search,
    leadStatus: query.leadStatus,
    sourceLabel: query.sourceLabel,
    ownerUserId: query.ownerUserId,
    page: query.page ? parseInt(query.page, 10) : undefined,
    limit: query.limit ? parseInt(query.limit, 10) : undefined,
  });
  return c.json(result);
});

leads.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const input = createLeadSchema.parse(body);
  const lead = await leadsService.createLead(
    { ...input, organizationId: user.organizationId },
    user.id,
  );
  return c.json(lead, 201);
});

leads.post('/bulk', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const leadsInput = z.array(createLeadSchema).parse(body.leads);
  const results = await leadsService.bulkCreateLeads(
    leadsInput.map((l) => ({ ...l, organizationId: user.organizationId })),
    user.id,
  );
  return c.json({ results });
});

leads.get('/:id', async (c) => {
  const user = getUser(c);
  const lead = await leadsService.getLeadById(c.req.param('id'), user.organizationId);
  return c.json(lead);
});

leads.patch('/:id', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const lead = await leadsService.updateLead(c.req.param('id'), user.organizationId, body, user.id);
  return c.json(lead);
});

leads.post('/:id/score', async (c) => {
  const user = getUser(c);
  const score = await scoringService.scoreLead({
    leadId: c.req.param('id'),
    organizationId: user.organizationId,
    triggerEvent: 'manual_rescore',
  });
  return c.json(score);
});

export default leads;
