import { Hono } from 'hono';
import { z } from 'zod';
import * as tasksService from '../services/tasks-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const tasks = new Hono();
tasks.use('*', authMiddleware);

tasks.get('/', async (c) => {
  const user = getUser(c);
  const status = c.req.query('status');
  const result = await tasksService.getTasks(user.organizationId, { status: status || undefined });
  return c.json(result);
});

tasks.patch('/:id/status', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const { status } = z.object({ status: z.string() }).parse(body);
  const result = await tasksService.updateTaskStatus(c.req.param('id'), user.organizationId, status, user.id);
  return c.json(result);
});

tasks.get('/escalation/:id', async (c) => {
  const user = getUser(c);
  const result = await tasksService.getEscalationView(c.req.param('id'), user.organizationId);
  return c.json(result);
});

export default tasks;
