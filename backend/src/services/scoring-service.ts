import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { NotFoundError } from '../lib/errors.js';

export interface ScoreInput {
  leadId: string;
  organizationId: string;
  triggerEvent?: string;
}

// TODO: Replace with real Claude API call for production
async function computeScore(leadId: string): Promise<{
  totalScore: number;
  fitScore: number;
  urgencyScore: number;
  engagementScore: number;
  motivationScore: number;
  closeProbability: number;
  preferredChannel: string;
  recommendedAngle: string;
  recommendedPersona: string;
  nextBestAction: string;
  nextBestActionReason: string;
  urgencyLevel: string;
  recommendedDelayHours: number;
  shouldRunOpenclaw: boolean;
  shouldCreateHumanTask: boolean;
  explanation: string;
}> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      enrichments: { take: 1, orderBy: { lastEnrichedAt: 'desc' } },
      messages: { take: 20, orderBy: { createdAt: 'desc' } },
      scores: { take: 1, orderBy: { scoredAt: 'desc' } },
      personaMemories: { take: 5, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!lead) throw new NotFoundError('Lead');

  // Heuristic scoring engine — real implementation uses Claude API structured output
  const hasEnrichment = lead.enrichments.length > 0;
  const messageCount = lead.messages.length;
  const hasReplied = lead.messages.some((m) => m.direction === 'inbound');
  const previousScore = lead.scores[0];

  let fitScore = hasEnrichment ? 60 : 30;
  let engagementScore = Math.min(messageCount * 10, 80);
  if (hasReplied) engagementScore = Math.max(engagementScore, 50);
  let urgencyScore = 40;
  let motivationScore = 35;

  // Apply decay from previous if no new engagement
  if (previousScore?.scoreDecayApplied) {
    engagementScore = Math.max(engagementScore - 10, 0);
  }

  const totalScore = Math.round(
    fitScore * 0.3 + urgencyScore * 0.2 + engagementScore * 0.3 + motivationScore * 0.2,
  );
  const closeProbability = Math.round(totalScore * 0.8) / 100;

  let nextBestAction = 'send_intro_sms';
  let nextBestActionReason = 'New lead needs initial outreach';

  if (hasReplied) {
    nextBestAction = 'send_followup_sms';
    nextBestActionReason = 'Lead has replied — continue conversation';
  }
  if (totalScore > 80) {
    nextBestAction = 'call_now';
    nextBestActionReason = 'Hot lead with high engagement — prioritize direct call';
  }
  if (lead.doNotContact) {
    nextBestAction = 'stop_outreach';
    nextBestActionReason = 'Lead marked do not contact';
  }

  return {
    totalScore,
    fitScore,
    urgencyScore,
    engagementScore,
    motivationScore,
    closeProbability,
    preferredChannel: 'sms',
    recommendedAngle: 'value_proposition',
    recommendedPersona: 'professional',
    nextBestAction,
    nextBestActionReason,
    urgencyLevel: totalScore > 70 ? 'high' : totalScore > 40 ? 'medium' : 'low',
    recommendedDelayHours: totalScore > 70 ? 0 : 24,
    shouldRunOpenclaw: totalScore > 75,
    shouldCreateHumanTask: totalScore > 85,
    explanation: `Score computed based on enrichment(${hasEnrichment}), messages(${messageCount}), replies(${hasReplied})`,
  };
}

export async function scoreLead(input: ScoreInput) {
  const scoreData = await computeScore(input.leadId);

  const score = await db.leadScore.create({
    data: {
      leadId: input.leadId,
      totalScore: scoreData.totalScore,
      fitScore: scoreData.fitScore,
      urgencyScore: scoreData.urgencyScore,
      engagementScore: scoreData.engagementScore,
      motivationScore: scoreData.motivationScore,
      closeProbability: scoreData.closeProbability,
      preferredChannel: scoreData.preferredChannel,
      recommendedAngle: scoreData.recommendedAngle,
      recommendedPersona: scoreData.recommendedPersona,
      nextBestAction: scoreData.nextBestAction,
      nextBestActionReason: scoreData.nextBestActionReason,
      urgencyLevel: scoreData.urgencyLevel,
      recommendedDelayHours: scoreData.recommendedDelayHours,
      shouldRunOpenclaw: scoreData.shouldRunOpenclaw,
      shouldCreateHumanTask: scoreData.shouldCreateHumanTask,
      explanationJson: { explanation: scoreData.explanation },
      modelVersion: 'heuristic-v1',
      scoredAt: new Date(),
      lastEngagementEvent: input.triggerEvent,
    },
  });

  // Store AI decision
  await db.aiDecision.create({
    data: {
      leadId: input.leadId,
      decisionType: 'lead_scoring',
      inputJson: { leadId: input.leadId, triggerEvent: input.triggerEvent },
      outputJson: scoreData as any,
      modelVersion: 'heuristic-v1',
    },
  });

  await writeAuditLog({
    organizationId: input.organizationId,
    entityType: 'lead_score',
    entityId: score.id,
    action: 'scored',
    metadata: { totalScore: scoreData.totalScore, nba: scoreData.nextBestAction },
  });

  await emitEvent('lead.scored', {
    leadId: input.leadId,
    scoreId: score.id,
    totalScore: scoreData.totalScore,
  });

  return score;
}

export async function applyScoreDecay(leadId: string, organizationId: string) {
  const latestScore = await db.leadScore.findFirst({
    where: { leadId },
    orderBy: { scoredAt: 'desc' },
  });

  if (!latestScore) return null;

  const decayedEngagement = Math.max(latestScore.engagementScore - 15, 0);
  const newTotal = Math.round(
    latestScore.fitScore * 0.3 +
    latestScore.urgencyScore * 0.2 +
    decayedEngagement * 0.3 +
    latestScore.motivationScore * 0.2,
  );

  let nextBestAction = latestScore.nextBestAction;
  let nextBestActionReason = latestScore.nextBestActionReason;

  if (newTotal < 30) {
    nextBestAction = 'move_to_nurture';
    nextBestActionReason = 'Score decayed below threshold — move to long-term nurture';
  } else if (newTotal < 50) {
    nextBestAction = 'wait';
    nextBestActionReason = 'Score decayed — wait before next touchpoint';
  }

  const score = await db.leadScore.create({
    data: {
      leadId,
      totalScore: newTotal,
      fitScore: latestScore.fitScore,
      urgencyScore: latestScore.urgencyScore,
      engagementScore: decayedEngagement,
      motivationScore: latestScore.motivationScore,
      closeProbability: Math.round(newTotal * 0.8) / 100,
      preferredChannel: latestScore.preferredChannel,
      recommendedAngle: latestScore.recommendedAngle,
      recommendedPersona: latestScore.recommendedPersona,
      nextBestAction,
      nextBestActionReason,
      urgencyLevel: newTotal > 70 ? 'high' : newTotal > 40 ? 'medium' : 'low',
      recommendedDelayHours: 48,
      shouldRunOpenclaw: false,
      shouldCreateHumanTask: false,
      explanationJson: { reason: 'Score decay applied due to no response' },
      modelVersion: 'decay-v1',
      scoredAt: new Date(),
      scoreDecayApplied: true,
      lastEngagementEvent: 'no_response_decay',
    },
  });

  await emitEvent('lead.score_decayed', { leadId, scoreId: score.id, newTotal });

  return score;
}
