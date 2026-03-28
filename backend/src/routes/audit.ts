import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const audit = new Hono();
audit.use('*', authMiddleware);

audit.get('/logs', async (c) => {
  const user = getUser(c);
  const query = c.req.query();

  const where: any = { organizationId: user.organizationId };
  if (query.entityType) where.entityType = query.entityType;
  if (query.action) where.action = query.action;
  if (query.entityId) where.entityId = query.entityId;

  const page = parseInt(query.page || '1', 10);
  const limit = parseInt(query.limit || '50', 10);
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ]);

  return c.json({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
});

audit.get('/ai-decisions', async (c) => {
  const user = getUser(c);
  const query = c.req.query();

  const where: any = {};
  if (query.leadId) where.leadId = query.leadId;
  if (query.decisionType) where.decisionType = query.decisionType;

  const page = parseInt(query.page || '1', 10);
  const limit = parseInt(query.limit || '30', 10);
  const skip = (page - 1) * limit;

  const [decisions, total] = await Promise.all([
    db.aiDecision.findMany({
      where,
      include: { lead: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.aiDecision.count({ where }),
  ]);

  return c.json({ decisions, total, page, limit, totalPages: Math.ceil(total / limit) });
});

export default audit;
