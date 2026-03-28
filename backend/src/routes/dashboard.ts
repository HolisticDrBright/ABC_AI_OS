import { Hono } from 'hono';
import * as analyticsService from '../services/analytics-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const dashboard = new Hono();
dashboard.use('*', authMiddleware);

dashboard.get('/stats', async (c) => {
  const user = getUser(c);
  const stats = await analyticsService.getDashboardStats(user.organizationId);
  return c.json(stats);
});

export default dashboard;
