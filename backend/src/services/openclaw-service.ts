import { config } from '../lib/config.js';
import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { NotFoundError } from '../lib/errors.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

// ==================== OPENCLAW CLIENT ====================

async function callOpenClaw(workflowType: string, payload: any): Promise<any> {
  if (!config.openclaw.apiUrl || !config.openclaw.apiKey) {
    throw new Error('OpenClaw not configured');
  }

  const res = await fetch(`${config.openclaw.apiUrl}/v1/workflows/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openclaw.apiKey}`,
    },
    body: JSON.stringify({ workflow_type: workflowType, payload }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenClaw ${res.status}: ${body}`);
  }

  return res.json();
}

// ==================== CLAUDE FALLBACK ====================

async function claudeFallback(workflowType: string, payload: any): Promise<any> {
  const prompts: Record<string, string> = {
    deep_lead_research: `You are a real estate lead research analyst. Analyze this lead and provide:
1. Lead summary (2-3 sentences)
2. Likely motivations for selling/buying
3. Likely objections they may have
4. 3 custom outreach ideas tailored to this person
5. Call prep notes for a sales agent

Respond with ONLY valid JSON:
{
  "lead_summary": "",
  "likely_motivations": [],
  "likely_objections": [],
  "custom_outreach_ideas": [],
  "call_prep_notes": ""
}`,

    personalized_followup_plan: `You are a real estate sales strategist. Create a personalized follow-up plan:
1. A 3-step follow-up sequence with timing
2. Ideal message angles for each step
3. Escalation threshold (when to hand off to human)

Respond with ONLY valid JSON:
{
  "followup_steps": [{"step": 1, "timing": "", "message_angle": "", "channel": ""}],
  "ideal_angles": [],
  "escalation_threshold": ""
}`,

    hot_lead_call_brief: `You are a real estate sales coach. Create a one-page call brief:
1. Probable goals of this lead
2. Probable resistance points
3. Recommended opening line
4. Recommended close questions (2-3)
5. Key talking points

Respond with ONLY valid JSON:
{
  "probable_goals": [],
  "resistance_points": [],
  "recommended_opener": "",
  "close_questions": [],
  "key_talking_points": []
}`,
  };

  const systemPrompt = prompts[workflowType] || prompts.deep_lead_research;

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropic.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Analyze this lead:\n${JSON.stringify(payload, null, 2)}` }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude fallback ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude fallback response');

  return JSON.parse(jsonMatch[0]);
}

// ==================== JOB RUNNER ====================

export type WorkflowType = 'deep_lead_research' | 'personalized_followup_plan' | 'hot_lead_call_brief';

export async function runWorkflow(params: {
  leadId: string;
  organizationId: string;
  workflowType: WorkflowType;
  userId?: string;
}) {
  const lead = await db.lead.findFirst({
    where: { id: params.leadId, organizationId: params.organizationId },
    include: {
      identity: true,
      enrichments: { take: 1, orderBy: { lastEnrichedAt: 'desc' } },
      messages: { take: 10, orderBy: { createdAt: 'desc' } },
      scores: { take: 1, orderBy: { scoredAt: 'desc' } },
      leadSegments: { include: { segment: true } },
      campaignLeads: { include: { campaign: true } },
    },
  });

  if (!lead) throw new NotFoundError('Lead');

  const inputPayload = {
    lead_identity: {
      name: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      title: lead.title,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
    },
    enrichment_snapshot: lead.enrichments[0]?.rawPayloadJson || null,
    recent_messages: lead.messages.map((m) => ({
      direction: m.direction,
      body: m.body.substring(0, 300),
      date: m.createdAt,
    })),
    current_score: lead.scores[0]
      ? {
          total: lead.scores[0].totalScore,
          fit: lead.scores[0].fitScore,
          engagement: lead.scores[0].engagementScore,
          nba: lead.scores[0].nextBestAction,
        }
      : null,
    current_segment: lead.leadSegments.map((ls) => ls.segment.name).join(', '),
    campaign_context: lead.campaignLeads.map((cl) => ({
      campaign: cl.campaign.name,
      status: cl.status,
    })),
    workflow_type: params.workflowType,
  };

  // Create job record
  const job = await db.openclawJob.create({
    data: {
      organizationId: params.organizationId,
      leadId: params.leadId,
      workflowType: params.workflowType,
      inputPayloadJson: inputPayload as any,
      status: 'running',
      startedAt: new Date(),
    },
  });

  await emitEvent('openclaw.job_requested', { jobId: job.id, workflowType: params.workflowType });

  let result: any;
  let usedFallback = false;

  try {
    // Try OpenClaw first
    result = await callOpenClaw(params.workflowType, inputPayload);
  } catch (openclawErr: any) {
    console.warn(`[OpenClaw] Failed, falling back to Claude: ${openclawErr.message}`);
    usedFallback = true;

    try {
      result = await claudeFallback(params.workflowType, inputPayload);
    } catch (fallbackErr: any) {
      await db.openclawJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: `OpenClaw: ${openclawErr.message}; Fallback: ${fallbackErr.message}`,
          completedAt: new Date(),
        },
      });
      throw fallbackErr;
    }
  }

  // Update job with result
  await db.openclawJob.update({
    where: { id: job.id },
    data: {
      status: 'completed',
      outputPayloadJson: result as any,
      completedAt: new Date(),
    },
  });

  // Log AI decision
  await db.aiDecision.create({
    data: {
      leadId: params.leadId,
      decisionType: `openclaw_${params.workflowType}`,
      inputJson: inputPayload as any,
      outputJson: result as any,
      modelVersion: usedFallback ? 'claude-fallback' : 'openclaw',
    },
  });

  await writeAuditLog({
    organizationId: params.organizationId,
    userId: params.userId,
    entityType: 'openclaw_job',
    entityId: job.id,
    action: 'workflow_completed',
    metadata: { workflowType: params.workflowType, usedFallback },
  });

  const eventType = usedFallback ? 'openclaw.job_fallback_used' : 'openclaw.job_completed';
  await emitEvent(eventType, { jobId: job.id, workflowType: params.workflowType });

  return { job, result, usedFallback };
}

// ==================== GET JOBS ====================

export async function getJobs(organizationId: string, status?: string) {
  const where: any = { organizationId };
  if (status) where.status = status;

  return db.openclawJob.findMany({
    where,
    include: {
      lead: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
