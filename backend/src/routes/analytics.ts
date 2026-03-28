import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const analytics = new Hono();
analytics.use('*', authMiddleware);

// Overall messaging stats
analytics.get('/messaging', async (c) => {
  const user = getUser(c);
  const orgId = user.organizationId;

  const [sent, delivered, failed, inbound] = await Promise.all([
    db.message.count({ where: { organizationId: orgId, direction: 'outbound' } }),
    db.message.count({ where: { organizationId: orgId, direction: 'outbound', status: 'delivered' } }),
    db.message.count({ where: { organizationId: orgId, direction: 'outbound', status: 'failed' } }),
    db.message.count({ where: { organizationId: orgId, direction: 'inbound' } }),
  ]);

  const replyRate = sent > 0 ? Math.round((inbound / sent) * 10000) / 100 : 0;

  // Messages by day (last 14 days)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);
  const recentMessages = await db.message.findMany({
    where: { organizationId: orgId, createdAt: { gte: fourteenDaysAgo } },
    select: { direction: true, createdAt: true, status: true },
  });

  const dailyBuckets: Record<string, { sent: number; received: number }> = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().split('T')[0];
    dailyBuckets[key] = { sent: 0, received: 0 };
  }
  for (const msg of recentMessages) {
    const key = new Date(msg.createdAt).toISOString().split('T')[0];
    if (dailyBuckets[key]) {
      if (msg.direction === 'outbound') dailyBuckets[key].sent++;
      else dailyBuckets[key].received++;
    }
  }

  const daily = Object.entries(dailyBuckets)
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return c.json({ sent, delivered, failed, inbound, replyRate, daily });
});

// Score distribution
analytics.get('/scores', async (c) => {
  const user = getUser(c);

  // Get latest score per lead
  const scores = await db.leadScore.findMany({
    where: { lead: { organizationId: user.organizationId } },
    orderBy: { scoredAt: 'desc' },
    distinct: ['leadId'],
    select: { totalScore: true, closeProbability: true, nextBestAction: true, urgencyLevel: true },
  });

  // Distribution buckets
  const buckets = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
  for (const s of scores) {
    const t = s.totalScore;
    if (t <= 20) buckets['0-20']++;
    else if (t <= 40) buckets['21-40']++;
    else if (t <= 60) buckets['41-60']++;
    else if (t <= 80) buckets['61-80']++;
    else buckets['81-100']++;
  }

  // NBA distribution
  const nbaDistribution: Record<string, number> = {};
  for (const s of scores) {
    nbaDistribution[s.nextBestAction] = (nbaDistribution[s.nextBestAction] || 0) + 1;
  }

  // Urgency distribution
  const urgencyDistribution: Record<string, number> = {};
  for (const s of scores) {
    const level = s.urgencyLevel || 'unknown';
    urgencyDistribution[level] = (urgencyDistribution[level] || 0) + 1;
  }

  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length)
    : 0;

  const avgCloseProbability = scores.length > 0
    ? Math.round((scores.reduce((sum, s) => sum + s.closeProbability, 0) / scores.length) * 100)
    : 0;

  return c.json({
    total: scores.length,
    avgScore,
    avgCloseProbability,
    distribution: buckets,
    nbaDistribution,
    urgencyDistribution,
  });
});

// Campaign performance comparison
analytics.get('/campaigns', async (c) => {
  const user = getUser(c);

  const campaigns = await db.campaign.findMany({
    where: { organizationId: user.organizationId },
    include: {
      _count: { select: { campaignLeads: true, messages: true } },
      variants: true,
    },
  });

  const results = [];
  for (const campaign of campaigns) {
    const outbound = await db.message.count({
      where: { campaignId: campaign.id, direction: 'outbound' },
    });
    const inbound = await db.message.count({
      where: { campaignId: campaign.id, direction: 'inbound' },
    });
    const replyRate = outbound > 0 ? Math.round((inbound / outbound) * 10000) / 100 : 0;

    results.push({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      leads: campaign._count.campaignLeads,
      sent: outbound,
      replies: inbound,
      replyRate,
      variants: campaign.variants.map((v) => ({
        label: v.variantLabel,
        messageCount: v.messageCount,
        replyRate: v.replyRate,
        positiveRate: v.positiveRate,
      })),
    });
  }

  return c.json(results);
});

// Human handoff rate
analytics.get('/handoffs', async (c) => {
  const user = getUser(c);

  const totalTasks = await db.task.count({
    where: { organizationId: user.organizationId },
  });
  const escalations = await db.task.count({
    where: { organizationId: user.organizationId, taskType: 'human_escalation' },
  });
  const totalLeads = await db.lead.count({ where: { organizationId: user.organizationId } });
  const handoffRate = totalLeads > 0 ? Math.round((escalations / totalLeads) * 10000) / 100 : 0;

  return c.json({ totalTasks, escalations, handoffRate, totalLeads });
});

// Classification breakdown
analytics.get('/classifications', async (c) => {
  const user = getUser(c);

  const classifications = await db.conversationClassification.findMany({
    where: { conversation: { organizationId: user.organizationId } },
    select: { classification: true, confidence: true },
  });

  const breakdown: Record<string, { count: number; avgConfidence: number }> = {};
  for (const cl of classifications) {
    if (!breakdown[cl.classification]) {
      breakdown[cl.classification] = { count: 0, avgConfidence: 0 };
    }
    breakdown[cl.classification].count++;
    breakdown[cl.classification].avgConfidence += cl.confidence;
  }
  for (const key of Object.keys(breakdown)) {
    breakdown[key].avgConfidence = Math.round(
      (breakdown[key].avgConfidence / breakdown[key].count) * 100,
    ) / 100;
  }

  return c.json({ total: classifications.length, breakdown });
});

export default analytics;
