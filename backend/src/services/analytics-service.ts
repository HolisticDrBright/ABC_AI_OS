import { db } from '../lib/db.js';

export async function getDashboardStats(organizationId: string) {
  const [
    totalLeads,
    hotLeads,
    activeConversations,
    activeCampaigns,
    pendingTasks,
    recentMessages,
  ] = await Promise.all([
    db.lead.count({ where: { organizationId } }),
    db.leadScore.count({
      where: {
        lead: { organizationId },
        totalScore: { gte: 80 },
        scoredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    db.conversation.count({
      where: { organizationId, threadStatus: 'open' },
    }),
    db.campaign.count({
      where: { organizationId, status: 'active' },
    }),
    db.task.count({
      where: { organizationId, status: 'pending' },
    }),
    db.message.count({
      where: {
        organizationId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    totalLeads,
    hotLeads,
    activeConversations,
    activeCampaigns,
    pendingTasks,
    recentMessages,
  };
}

export async function getCampaignAnalytics(campaignId: string) {
  const [totalEnrolled, messages, variants] = await Promise.all([
    db.campaignLead.count({ where: { campaignId } }),
    db.message.findMany({
      where: { campaignId },
      select: { direction: true, status: true, variant: true, aiGenerated: true },
    }),
    db.campaignVariant.findMany({ where: { campaignId } }),
  ]);

  const sent = messages.filter((m) => m.direction === 'outbound').length;
  const delivered = messages.filter((m) => m.status === 'delivered').length;
  const replies = messages.filter((m) => m.direction === 'inbound').length;
  const replyRate = sent > 0 ? (replies / sent) * 100 : 0;

  return {
    totalEnrolled,
    sent,
    delivered,
    replies,
    replyRate: Math.round(replyRate * 100) / 100,
    variants,
  };
}
