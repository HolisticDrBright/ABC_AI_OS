import { Hono } from 'hono';
import { z } from 'zod';
import * as fubService from '../services/followupboss-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const fub = new Hono();
fub.use('*', authMiddleware);

fub.post('/sync/:leadId', async (c) => {
  const user = getUser(c);
  const result = await fubService.syncLeadToFUB(c.req.param('leadId'), user.organizationId, user.id);
  return c.json(result);
});

fub.post('/note/:leadId', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const { note } = z.object({ note: z.string().min(1) }).parse(body);
  const result = await fubService.pushNoteToFUB(c.req.param('leadId'), user.organizationId, note);
  return c.json(result);
});

fub.post('/task/:leadId', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const task = z.object({
    name: z.string(),
    description: z.string().optional(),
    dueAt: z.string().optional(),
  }).parse(body);
  const result = await fubService.pushTaskToFUB(c.req.param('leadId'), user.organizationId, task);
  return c.json(result);
});

fub.post('/import-stale', async (c) => {
  const user = getUser(c);
  const result = await fubService.importStaleLeadsFromFUB(user.organizationId, user.id);
  return c.json(result);
});

fub.get('/sync-log/:leadId', async (c) => {
  const user = getUser(c);
  const logs = await (await import('../lib/db.js')).db.followupbossSyncLog.findMany({
    where: { leadId: c.req.param('leadId') },
    orderBy: { syncedAt: 'desc' },
    take: 20,
  });
  return c.json(logs);
});

export default fub;
