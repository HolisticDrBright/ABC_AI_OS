import { onEvent, emitEvent } from '../lib/event-bus.js';
import { db } from '../lib/db.js';

/**
 * Register all event handlers.
 * Call this once at startup to wire up the event-driven architecture.
 */
export function registerEventHandlers() {
  // When a lead is created, auto-score and route inbound leads
  onEvent('lead.created', async (payload) => {
    const { leadId, organizationId } = payload as { leadId: string; organizationId: string };
    console.log(`[Event] lead.created: ${leadId}`);

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    // All new leads get scored immediately — NBA must never be empty
    try {
      const { scoreLead } = await import('../services/scoring-service.js');
      await scoreLead({ leadId, organizationId, triggerEvent: 'lead_created' });
      console.log(`[Event] Auto-scored new lead: ${leadId}`);
    } catch (err: any) {
      console.error(`[Event] Auto-score failed for ${leadId}:`, err.message);
    }

    // Inbound leads get full routing: enrich -> score -> NBA -> FUB sync
    if (lead.inboundSource) {
      console.log(`[Event] Inbound lead routing: ${leadId}, source: ${lead.inboundSource}`);

      // Try Apollo enrichment (non-blocking)
      if (lead.email) {
        try {
          const { importAndEnrichLead } = await import('../services/apollo-service.js');
          await importAndEnrichLead(leadId, organizationId);
        } catch (err: any) {
          console.warn(`[Event] Apollo enrich failed for inbound lead ${leadId}:`, err.message);
        }
      }

      // Trigger FUB sync
      await emitEvent('followupboss.sync_requested', { leadId, organizationId });
    }
  });

  // When a lead is enriched, trigger re-scoring
  onEvent('lead.enriched', async (payload) => {
    const { leadId } = payload as { leadId: string; organizationId?: string };
    console.log(`[Event] lead.enriched: ${leadId} — triggering rescore`);

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    try {
      const { scoreLead } = await import('../services/scoring-service.js');
      await scoreLead({ leadId, organizationId: lead.organizationId, triggerEvent: 'enrichment_completed' });
    } catch (err: any) {
      console.error(`[Event] Rescore after enrichment failed for ${leadId}:`, err.message);
    }
  });

  // When a lead is scored, check NBA for follow-up actions
  onEvent('lead.scored', async (payload) => {
    const { leadId, scoreId, totalScore } = payload as {
      leadId: string;
      scoreId: string;
      totalScore: number;
    };
    console.log(`[Event] lead.scored: ${leadId} = ${totalScore}`);

    if (totalScore >= 80) {
      console.log(`[Event] Hot lead detected: ${leadId}`);
    }
  });

  // Message sent — update conversation and check for sequence progression
  onEvent('message.sent', async (payload) => {
    const { messageId, leadId, campaignId } = payload as {
      messageId: string;
      leadId: string;
      campaignId?: string;
    };
    console.log(`[Event] message.sent: ${messageId} to lead ${leadId}`);

    // Update conversation last_message_at
    await db.conversation.upsert({
      where: { leadId_channel: { leadId, channel: 'sms' } },
      update: { lastMessageAt: new Date() },
      create: {
        organizationId: (await db.lead.findUnique({ where: { id: leadId } }))!.organizationId,
        leadId,
        channel: 'sms',
        lastMessageAt: new Date(),
      },
    });

    // Update lead status
    await db.lead.update({
      where: { id: leadId },
      data: { leadStatus: 'contacted' },
    });
  });

  // Inbound reply — auto-classify and re-score
  onEvent('inbound.reply_received', async (payload) => {
    const { messageId, leadId, conversationId, organizationId } = payload as {
      messageId: string;
      leadId: string;
      conversationId: string;
      organizationId: string;
    };
    console.log(`[Event] inbound.reply_received: ${messageId} from lead ${leadId}`);

    // Auto-classify the reply
    try {
      const { classifyReply } = await import('../services/ai-engine.js');
      await classifyReply({ messageId, conversationId, organizationId });
      console.log(`[Event] Auto-classified reply: ${messageId}`);
    } catch (err: any) {
      console.error(`[Event] Reply classification failed for ${messageId}:`, err.message);
    }

    // Re-score lead on reply (engagement event)
    try {
      const { scoreLead } = await import('../services/scoring-service.js');
      await scoreLead({ leadId, organizationId, triggerEvent: 'inbound_reply' });
    } catch (err: any) {
      console.error(`[Event] Rescore on reply failed for ${leadId}:`, err.message);
    }
  });

  // Reply classified — update lead score and NBA
  onEvent('reply.classified', async (payload) => {
    const { conversationId, classification, escalate } = payload as {
      conversationId: string;
      messageId: string;
      classification: string;
      escalate: boolean;
    };
    console.log(`[Event] reply.classified: ${classification}, escalate: ${escalate}`);
  });

  // Score decayed — log it
  onEvent('lead.score_decayed', async (payload) => {
    const { leadId, newTotal } = payload as { leadId: string; scoreId: string; newTotal: number };
    console.log(`[Event] lead.score_decayed: ${leadId} -> ${newTotal}`);
  });

  // Task escalation
  onEvent('task.escalated', async (payload) => {
    const { leadId, conversationId, reason, organizationId } = payload as {
      leadId: string;
      conversationId?: string;
      reason: string;
      organizationId: string;
    };
    console.log(`[Event] task.escalated: ${leadId} — ${reason}`);

    // Create the escalation task
    const { createEscalationTask } = await import('../services/tasks-service.js');
    await createEscalationTask({
      organizationId,
      leadId,
      conversationId,
      reason,
    });
  });

  // FUB sync requested — actually sync the lead
  onEvent('followupboss.sync_requested', async (payload) => {
    const { leadId, organizationId } = payload as { leadId: string; organizationId: string };
    console.log(`[Event] followupboss.sync_requested: ${leadId}`);

    try {
      const { syncLeadToFUB } = await import('../services/followupboss-service.js');
      await syncLeadToFUB(leadId, organizationId);
      console.log(`[Event] FUB sync completed: ${leadId}`);
    } catch (err: any) {
      console.warn(`[Event] FUB sync failed for ${leadId}:`, err.message);
    }
  });

  // OpenClaw job completed
  onEvent('openclaw.job_completed', async (payload) => {
    const { jobId, workflowType } = payload as { jobId: string; workflowType: string };
    console.log(`[Event] openclaw.job_completed: ${jobId} (${workflowType})`);
  });

  // OpenClaw fallback used
  onEvent('openclaw.job_fallback_used', async (payload) => {
    const { jobId, workflowType } = payload as { jobId: string; workflowType: string };
    console.log(`[Event] openclaw.job_fallback_used: ${jobId} (${workflowType}) — Claude API used`);
  });

  // Campaign events
  onEvent('campaign.lead_enrolled', async (payload) => {
    const { campaignId, leadId, variant } = payload as {
      campaignId: string;
      leadId: string;
      variant?: string;
    };
    console.log(`[Event] campaign.lead_enrolled: ${leadId} in ${campaignId} variant=${variant}`);
  });

  // Message delivery
  onEvent('message.delivered', async (payload) => {
    const { messageId } = payload as { messageId: string };
    console.log(`[Event] message.delivered: ${messageId}`);
  });

  // Message failed
  onEvent('message.failed', async (payload) => {
    const { messageId, error } = payload as { messageId: string; error?: string };
    console.error(`[Event] message.failed: ${messageId} — ${error}`);
  });

  // No response threshold
  onEvent('message.no_response_threshold_reached', async (payload) => {
    const { leadId, organizationId } = payload as { leadId: string; organizationId: string };
    console.log(`[Event] no_response_threshold: ${leadId} — applying decay`);

    const { applyScoreDecay } = await import('../services/scoring-service.js');
    await applyScoreDecay(leadId, organizationId);
  });

  console.log('[Workers] All event handlers registered');
}
