import { Hono } from 'hono';
import { z } from 'zod';
import * as apolloService from '../services/apollo-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const apollo = new Hono();
apollo.use('*', authMiddleware);

apollo.post('/search', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const params = z.object({
    q_keywords: z.string().optional(),
    person_titles: z.array(z.string()).optional(),
    person_locations: z.array(z.string()).optional(),
    per_page: z.number().optional(),
    page: z.number().optional(),
  }).parse(body);

  const result = await apolloService.searchPeople(params);
  return c.json(result);
});

apollo.post('/import', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const params = z.object({
    q_keywords: z.string().optional(),
    person_titles: z.array(z.string()).optional(),
    person_locations: z.array(z.string()).optional(),
    per_page: z.number().optional(),
  }).parse(body);

  const result = await apolloService.bulkSearchAndImport(user.organizationId, params, user.id);
  return c.json(result);
});

apollo.post('/enrich/:leadId', async (c) => {
  const user = getUser(c);
  const result = await apolloService.importAndEnrichLead(c.req.param('leadId'), user.organizationId, user.id);
  return c.json(result);
});

export default apollo;
