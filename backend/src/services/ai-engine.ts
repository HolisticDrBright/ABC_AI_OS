import { db } from '../lib/db.js';
import { config } from '../lib/config.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { NotFoundError } from '../lib/errors.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

async function callClaude<T>(systemPrompt: string, userContent: string): Promise<T> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.anthropic.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Claude API ${res.status}: ${body}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in Claude response');

      return JSON.parse(jsonMatch[0]) as T;
    } catch (err: any) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Claude API call failed after retries');
}

// ==================== LEAD SCORING ====================

interface ScoreOutput {
  total_score: number;
  fit_score: number;
  urgency_score: number;
  engagement_score: number;
  motivation_score: number;
  close_probability: number;
  preferred_channel: string;
  recommended_angle: string;
  recommended_persona: string;
  next_best_action: string;
  next_best_action_reason: string;
  urgency_level: string;
  recommended_delay_hours: number;
  should_run_openclaw: boolean;
  should_create_human_task: boolean;
  explanation: string;
}

const SCORING_SYSTEM_PROMPT = `You are an AI lead scoring engine for a real estate inside sales team.
Analyze the lead data and produce a structured JSON score.

Score ranges: 0-100 for each sub-score.
close_probability: 0.0 to 1.0

NBA values (pick exactly one):
send_intro_sms | send_followup_sms | wait | escalate_to_human | run_openclaw_research | call_now | move_to_nurture | stop_outreach

urgency_level: high | medium | low

Respond with ONLY valid JSON matching this schema:
{
  "total_score": number,
  "fit_score": number,
  "urgency_score": number,
  "engagement_score": number,
  "motivation_score": number,
  "close_probability": number,
  "preferred_channel": string,
  "recommended_angle": string,
  "recommended_persona": string,
  "next_best_action": string,
  "next_best_action_reason": string,
  "urgency_level": string,
  "recommended_delay_hours": number,
  "should_run_openclaw": boolean,
  "should_create_human_task": boolean,
  "explanation": string
}`;

export async function scoreLeadWithAI(leadId: string, organizationId: string, triggerEvent?: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId },
    include: {
      enrichments: { take: 1, orderBy: { lastEnrichedAt: 'desc' } },
      messages: { take: 20, orderBy: { createdAt: 'desc' } },
      scores: { take: 1, orderBy: { scoredAt: 'desc' } },
      personaMemories: { take: 5, orderBy: { createdAt: 'desc' } },
      leadSegments: { include: { segment: true } },
      campaignLeads: { include: { campaign: true } },
    },
  });

  if (!lead) throw new NotFoundError('Lead');

  const input = {
    lead_profile: {
      name: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      title: lead.title,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      status: lead.leadStatus,
      do_not_contact: lead.doNotContact,
      source: lead.sourceLabel,
      inbound_source: lead.inboundSource,
    },
    enrichment: lead.enrichments[0]?.rawPayloadJson || null,
    segment: lead.leadSegments.map((ls) => ls.segment.name).join(', '),
    engagement_history: lead.messages.map((m) => ({
      direction: m.direction,
      body: m.body.substring(0, 200),
      status: m.status,
      date: m.createdAt,
      ai_generated: m.aiGenerated,
    })),
    persona_memory: lead.personaMemories.map((pm) => ({
      persona: pm.personaMode,
      tone: pm.toneSignal,
      worked: pm.worked,
    })),
    campaign_context: lead.campaignLeads.map((cl) => ({
      campaign: cl.campaign.name,
      status: cl.status,
      step: cl.currentStep,
      variant: cl.variant,
    })),
    trigger_event: triggerEvent,
    previous_score: lead.scores[0]
      ? {
          total: lead.scores[0].totalScore,
          nba: lead.scores[0].nextBestAction,
          scored_at: lead.scores[0].scoredAt,
        }
      : null,
  };

  let scoreData: ScoreOutput;
  let modelVersion = MODEL;

  try {
    scoreData = await callClaude<ScoreOutput>(
      SCORING_SYSTEM_PROMPT,
      `Score this lead:\n${JSON.stringify(input, null, 2)}`,
    );
  } catch (err) {
    // Fallback to heuristic scoring
    console.warn('[Scoring] Claude API failed, using heuristic fallback:', err);
    modelVersion = 'heuristic-fallback-v1';
    scoreData = computeHeuristicScore(lead);
  }

  // Ensure NBA is never empty
  if (!scoreData.next_best_action) {
    scoreData.next_best_action = 'send_intro_sms';
    scoreData.next_best_action_reason = 'Default action — no AI recommendation available';
  }

  const score = await db.leadScore.create({
    data: {
      leadId,
      totalScore: clamp(scoreData.total_score, 0, 100),
      fitScore: clamp(scoreData.fit_score, 0, 100),
      urgencyScore: clamp(scoreData.urgency_score, 0, 100),
      engagementScore: clamp(scoreData.engagement_score, 0, 100),
      motivationScore: clamp(scoreData.motivation_score, 0, 100),
      closeProbability: clamp(scoreData.close_probability, 0, 1),
      preferredChannel: scoreData.preferred_channel || 'sms',
      recommendedAngle: scoreData.recommended_angle,
      recommendedPersona: scoreData.recommended_persona,
      nextBestAction: scoreData.next_best_action,
      nextBestActionReason: scoreData.next_best_action_reason,
      urgencyLevel: scoreData.urgency_level || 'medium',
      recommendedDelayHours: scoreData.recommended_delay_hours || 0,
      shouldRunOpenclaw: scoreData.should_run_openclaw || false,
      shouldCreateHumanTask: scoreData.should_create_human_task || false,
      explanationJson: { explanation: scoreData.explanation } as any,
      modelVersion,
      scoredAt: new Date(),
      lastEngagementEvent: triggerEvent,
    },
  });

  await db.aiDecision.create({
    data: {
      leadId,
      decisionType: 'lead_scoring',
      inputJson: input as any,
      outputJson: scoreData as any,
      modelVersion,
    },
  });

  await writeAuditLog({
    organizationId,
    entityType: 'lead_score',
    entityId: score.id,
    action: 'ai_scored',
    metadata: { totalScore: score.totalScore, nba: score.nextBestAction, model: modelVersion },
  });

  await emitEvent('lead.scored', { leadId, scoreId: score.id, totalScore: score.totalScore });

  if (scoreData.should_create_human_task) {
    await emitEvent('task.created', { leadId, organizationId, reason: 'AI recommended human task' });
  }

  return score;
}

// ==================== MESSAGE GENERATION ====================

interface MessageOutput {
  sms_body: string;
  alternative_sms_body: string;
  reason_for_choice: string;
  persona_tone_used: string;
}

const MESSAGE_GEN_SYSTEM_PROMPT = `You are an AI message generator for a real estate inside sales team.
Generate personalized SMS messages that feel human, conversational, and relevant.
Never include links, emojis, or anything that looks like spam.
Keep messages under 160 characters when possible, max 320 characters.
Use the lead's name naturally. Reference their location or context when available.

Respond with ONLY valid JSON:
{
  "sms_body": "the primary message",
  "alternative_sms_body": "an alternative version",
  "reason_for_choice": "why this approach",
  "persona_tone_used": "the tone used"
}`;

export async function generateMessage(params: {
  leadId: string;
  organizationId: string;
  personaMode?: string;
  angle?: string;
  campaignObjective?: string;
  sequenceStage?: number;
}) {
  const lead = await db.lead.findFirst({
    where: { id: params.leadId, organizationId: params.organizationId },
    include: {
      messages: { take: 10, orderBy: { createdAt: 'desc' } },
      personaMemories: { take: 5, orderBy: { createdAt: 'desc' } },
      enrichments: { take: 1, orderBy: { lastEnrichedAt: 'desc' } },
      scores: { take: 1, orderBy: { scoredAt: 'desc' } },
    },
  });

  if (!lead) throw new NotFoundError('Lead');

  // Fetch neighborhood intel if available
  let neighborhoodData = null;
  if (lead.zip) {
    neighborhoodData = await db.neighborhoodIntelligence.findFirst({
      where: { zipCode: lead.zip },
      orderBy: { fetchedAt: 'desc' },
    });
  }

  const input = {
    lead_context: {
      name: lead.fullName || lead.firstName,
      company: lead.company,
      title: lead.title,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      source: lead.sourceLabel,
    },
    persona_mode: params.personaMode || lead.scores[0]?.recommendedPersona || 'professional',
    persona_memory: lead.personaMemories.map((pm) => ({
      persona: pm.personaMode,
      tone: pm.toneSignal,
      worked: pm.worked,
    })),
    angle: params.angle || lead.scores[0]?.recommendedAngle || 'value_proposition',
    campaign_objective: params.campaignObjective,
    sequence_stage: params.sequenceStage || 1,
    prior_messages: lead.messages.map((m) => ({
      direction: m.direction,
      body: m.body,
      date: m.createdAt,
    })),
    neighborhood_intelligence: neighborhoodData
      ? {
          avg_days_on_market: neighborhoodData.avgDaysOnMarket,
          median_sale_price: neighborhoodData.medianSalePrice,
          off_market_last_30d: neighborhoodData.offMarketTransactionsLast30d,
        }
      : null,
    compliance_rules: 'No links. No emojis. No spam language. Must feel human-written.',
  };

  let msgData: MessageOutput;
  let modelVersion = MODEL;

  try {
    msgData = await callClaude<MessageOutput>(
      MESSAGE_GEN_SYSTEM_PROMPT,
      `Generate outreach message:\n${JSON.stringify(input, null, 2)}`,
    );
  } catch {
    modelVersion = 'template-fallback-v1';
    const name = lead.firstName || 'there';
    msgData = {
      sms_body: `Hi ${name}, I work with homeowners in ${lead.city || 'your area'} and wanted to see if you've considered your options. Would you be open to a quick chat?`,
      alternative_sms_body: `Hey ${name}, just reaching out — I help property owners in ${lead.city || 'the area'} explore what their home could be worth in today's market. Interested?`,
      reason_for_choice: 'Fallback template — AI unavailable',
      persona_tone_used: 'professional',
    };
  }

  await db.aiDecision.create({
    data: {
      leadId: params.leadId,
      decisionType: 'message_generation',
      inputJson: input as any,
      outputJson: msgData as any,
      modelVersion,
    },
  });

  await emitEvent('message.generated', {
    leadId: params.leadId,
    organizationId: params.organizationId,
  });

  return { ...msgData, modelVersion };
}

// ==================== REPLY CLASSIFICATION ====================

interface ClassificationOutput {
  classification: string;
  confidence: number;
  recommended_action: string;
  suggested_reply: string;
  escalate_to_human: boolean;
  escalation_reason: string;
}

const CLASSIFICATION_SYSTEM_PROMPT = `You are an AI reply classifier for a real estate inside sales team.
Classify the incoming message and recommend the next action.

Classification labels (pick exactly one):
interested | curious | objection | timing_issue | not_interested | wrong_person | stop | already_has_agent | vague_positive | needs_call

confidence: 0.0 to 1.0

Respond with ONLY valid JSON:
{
  "classification": "label",
  "confidence": 0.0,
  "recommended_action": "what to do next",
  "suggested_reply": "a suggested response message",
  "escalate_to_human": false,
  "escalation_reason": ""
}`;

export async function classifyReply(params: {
  messageId: string;
  conversationId: string;
  organizationId: string;
}) {
  const message = await db.message.findUnique({ where: { id: params.messageId } });
  if (!message) throw new NotFoundError('Message');

  const conversation = await db.conversation.findUnique({
    where: { id: params.conversationId },
    include: {
      lead: {
        include: {
          messages: { take: 10, orderBy: { createdAt: 'desc' } },
          campaignLeads: { include: { campaign: true } },
        },
      },
    },
  });
  if (!conversation) throw new NotFoundError('Conversation');

  const input = {
    incoming_message: message.body,
    conversation_history: conversation.lead.messages.map((m) => ({
      direction: m.direction,
      body: m.body,
      date: m.createdAt,
    })),
    campaign_context: conversation.lead.campaignLeads.map((cl) => ({
      campaign: cl.campaign.name,
      objective: cl.campaign.objective,
    })),
  };

  let classData: ClassificationOutput;
  let modelVersion = MODEL;

  try {
    classData = await callClaude<ClassificationOutput>(
      CLASSIFICATION_SYSTEM_PROMPT,
      `Classify this reply:\n${JSON.stringify(input, null, 2)}`,
    );
  } catch {
    modelVersion = 'keyword-fallback-v1';
    classData = classifyByKeywords(message.body);
  }

  const classification = await db.conversationClassification.create({
    data: {
      conversationId: params.conversationId,
      messageId: params.messageId,
      classification: classData.classification,
      confidence: classData.confidence,
      explanationJson: { action: classData.recommended_action } as any,
      suggestedReply: classData.suggested_reply,
      suggestedAction: classData.recommended_action,
      modelVersion,
    },
  });

  await db.aiDecision.create({
    data: {
      leadId: conversation.leadId,
      decisionType: 'reply_classification',
      inputJson: input as any,
      outputJson: classData as any,
      modelVersion,
    },
  });

  // Write persona memory from classification
  const toneMap: Record<string, string> = {
    interested: 'warm',
    curious: 'warm',
    vague_positive: 'warm',
    needs_call: 'warm',
    objection: 'resistant',
    timing_issue: 'cool',
    not_interested: 'cool',
    already_has_agent: 'cool',
    wrong_person: 'neutral',
    stop: 'resistant',
  };

  const tone = toneMap[classData.classification] || 'neutral';
  const worked = ['interested', 'curious', 'vague_positive', 'needs_call'].includes(classData.classification);

  await db.leadPersonaMemory.create({
    data: {
      leadId: conversation.leadId,
      personaMode: 'auto_detected',
      toneSignal: tone,
      worked,
      sourceMessageId: params.messageId,
    },
  });

  await emitEvent('lead.persona_memory_updated', {
    leadId: conversation.leadId,
    tone,
    worked,
  });

  await emitEvent('reply.classified', {
    conversationId: params.conversationId,
    messageId: params.messageId,
    classification: classData.classification,
    escalate: classData.escalate_to_human,
  });

  // Trigger escalation if needed
  if (classData.escalate_to_human) {
    await emitEvent('task.escalated', {
      leadId: conversation.leadId,
      conversationId: params.conversationId,
      reason: classData.escalation_reason,
      organizationId: params.organizationId,
    });
  }

  return { classification, classData };
}

// ==================== NBA COMPUTATION ====================

interface NbaOutput {
  next_best_action: string;
  next_best_action_reason: string;
  urgency_level: string;
  recommended_delay_hours: number;
  should_run_openclaw: boolean;
  should_create_human_task: boolean;
}

const NBA_SYSTEM_PROMPT = `You are an AI next-best-action engine for a real estate inside sales team.
Determine what should happen next with this lead.

NBA values (pick exactly one):
send_intro_sms | send_followup_sms | wait | escalate_to_human | run_openclaw_research | call_now | move_to_nurture | stop_outreach

Respond with ONLY valid JSON:
{
  "next_best_action": "action",
  "next_best_action_reason": "why",
  "urgency_level": "high|medium|low",
  "recommended_delay_hours": 0,
  "should_run_openclaw": false,
  "should_create_human_task": false
}`;

export async function computeNBA(leadId: string, organizationId: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId },
    include: {
      scores: { take: 1, orderBy: { scoredAt: 'desc' } },
      messages: { take: 10, orderBy: { createdAt: 'desc' } },
      conversations: {
        include: {
          classifications: { take: 3, orderBy: { createdAt: 'desc' } },
        },
      },
      personaMemories: { take: 5, orderBy: { createdAt: 'desc' } },
      tasks: { where: { status: 'pending' } },
      campaignLeads: { include: { campaign: true } },
    },
  });

  if (!lead) throw new NotFoundError('Lead');

  const input = {
    lead_score: lead.scores[0] || null,
    campaign_state: lead.campaignLeads.map((cl) => ({
      campaign: cl.campaign.name,
      status: cl.status,
      step: cl.currentStep,
    })),
    conversation_history: lead.messages.map((m) => ({
      direction: m.direction,
      body: m.body.substring(0, 200),
      date: m.createdAt,
    })),
    recent_classifications: lead.conversations.flatMap((c) =>
      c.classifications.map((cl) => cl.classification),
    ),
    persona_memory: lead.personaMemories.map((pm) => ({
      persona: pm.personaMode,
      tone: pm.toneSignal,
      worked: pm.worked,
    })),
    open_tasks: lead.tasks.map((t) => ({ type: t.taskType, title: t.title })),
    human_ownership: !!lead.ownerUserId,
    do_not_contact: lead.doNotContact,
  };

  let nbaData: NbaOutput;

  try {
    nbaData = await callClaude<NbaOutput>(NBA_SYSTEM_PROMPT, JSON.stringify(input, null, 2));
  } catch {
    // Heuristic fallback
    nbaData = computeHeuristicNBA(lead);
  }

  // Never allow empty NBA
  if (!nbaData.next_best_action) {
    nbaData.next_best_action = 'wait';
    nbaData.next_best_action_reason = 'Default — insufficient data for recommendation';
  }

  if (lead.doNotContact) {
    nbaData.next_best_action = 'stop_outreach';
    nbaData.next_best_action_reason = 'Lead marked do not contact';
  }

  await emitEvent('next_best_action.updated', {
    leadId,
    nba: nbaData.next_best_action,
    reason: nbaData.next_best_action_reason,
  });

  return nbaData;
}

// ==================== HELPERS ====================

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function computeHeuristicScore(lead: any): ScoreOutput {
  const hasEnrichment = lead.enrichments?.length > 0;
  const messageCount = lead.messages?.length || 0;
  const hasReplied = lead.messages?.some((m: any) => m.direction === 'inbound');

  const fitScore = hasEnrichment ? 60 : 30;
  const engagementScore = Math.min(messageCount * 10 + (hasReplied ? 30 : 0), 90);
  const urgencyScore = lead.inboundSource ? 70 : 40;
  const motivationScore = 35;

  const totalScore = Math.round(fitScore * 0.3 + urgencyScore * 0.2 + engagementScore * 0.3 + motivationScore * 0.2);

  let nba = 'send_intro_sms';
  let nbaReason = 'New lead needs initial outreach';
  if (hasReplied) { nba = 'send_followup_sms'; nbaReason = 'Lead replied — continue engagement'; }
  if (totalScore > 80) { nba = 'call_now'; nbaReason = 'Hot lead — prioritize call'; }
  if (lead.doNotContact) { nba = 'stop_outreach'; nbaReason = 'DNC flagged'; }

  return {
    total_score: totalScore,
    fit_score: fitScore,
    urgency_score: urgencyScore,
    engagement_score: engagementScore,
    motivation_score: motivationScore,
    close_probability: totalScore / 125,
    preferred_channel: 'sms',
    recommended_angle: 'value_proposition',
    recommended_persona: 'professional',
    next_best_action: nba,
    next_best_action_reason: nbaReason,
    urgency_level: totalScore > 70 ? 'high' : totalScore > 40 ? 'medium' : 'low',
    recommended_delay_hours: totalScore > 70 ? 0 : 24,
    should_run_openclaw: totalScore > 75,
    should_create_human_task: totalScore > 85,
    explanation: 'Heuristic fallback scoring',
  };
}

function classifyByKeywords(body: string): ClassificationOutput {
  const lower = body.toLowerCase().trim();
  const stopWords = ['stop', 'unsubscribe', 'quit', 'remove me', 'opt out'];
  const positiveWords = ['yes', 'interested', 'tell me more', 'sure', 'sounds good', 'let\'s talk'];
  const negativeWords = ['no thanks', 'not interested', 'no', 'pass', 'don\'t contact'];
  const agentWords = ['already have an agent', 'working with someone', 'have a realtor'];

  if (stopWords.some((w) => lower.includes(w))) {
    return { classification: 'stop', confidence: 0.95, recommended_action: 'halt_outreach', suggested_reply: '', escalate_to_human: false, escalation_reason: '' };
  }
  if (agentWords.some((w) => lower.includes(w))) {
    return { classification: 'already_has_agent', confidence: 0.8, recommended_action: 'move_to_nurture', suggested_reply: '', escalate_to_human: false, escalation_reason: '' };
  }
  if (positiveWords.some((w) => lower.includes(w))) {
    return { classification: 'interested', confidence: 0.7, recommended_action: 'escalate_to_human', suggested_reply: '', escalate_to_human: true, escalation_reason: 'Lead expressed interest' };
  }
  if (negativeWords.some((w) => lower.includes(w))) {
    return { classification: 'not_interested', confidence: 0.7, recommended_action: 'move_to_nurture', suggested_reply: '', escalate_to_human: false, escalation_reason: '' };
  }

  return { classification: 'curious', confidence: 0.4, recommended_action: 'send_followup', suggested_reply: '', escalate_to_human: false, escalation_reason: '' };
}

function computeHeuristicNBA(lead: any): NbaOutput {
  if (lead.doNotContact) {
    return { next_best_action: 'stop_outreach', next_best_action_reason: 'DNC flagged', urgency_level: 'low', recommended_delay_hours: 0, should_run_openclaw: false, should_create_human_task: false };
  }

  const score = lead.scores?.[0];
  const hasMessages = lead.messages?.length > 0;
  const hasReplied = lead.messages?.some((m: any) => m.direction === 'inbound');

  if (hasReplied) {
    return { next_best_action: 'send_followup_sms', next_best_action_reason: 'Lead replied — continue conversation', urgency_level: 'high', recommended_delay_hours: 0, should_run_openclaw: false, should_create_human_task: (score?.totalScore || 0) > 80 };
  }

  if (!hasMessages) {
    return { next_best_action: 'send_intro_sms', next_best_action_reason: 'Lead has not been contacted', urgency_level: 'medium', recommended_delay_hours: 0, should_run_openclaw: false, should_create_human_task: false };
  }

  return { next_best_action: 'wait', next_best_action_reason: 'Messages sent, awaiting response', urgency_level: 'low', recommended_delay_hours: 24, should_run_openclaw: false, should_create_human_task: false };
}
