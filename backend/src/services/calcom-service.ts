/**
 * Cal.com — Meeting booking integration.
 * API v2, Bearer token auth.
 */

import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';
import { config } from '../lib/config.js';
import { callExternalAPI } from '../lib/external-api.js';

const CALCOM_BASE = 'https://api.cal.com/v2';

async function calcomRequest<T>(path: string, method = 'GET', body?: any): Promise<T> {
  const apiKey = (config as any).calcom?.apiKey;
  if (!apiKey) throw new Error('Cal.com API key not configured');

  const res = await fetch(`${CALCOM_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'cal-api-version': '2024-08-13',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Cal.com ${res.status}: ${errBody}`);
  }

  return res.json();
}

export function generateBookingUrl(agentSlug: string, leadContext?: { name?: string; email?: string }): string {
  const base = `https://cal.com/${agentSlug}`;
  const params = new URLSearchParams();
  if (leadContext?.name) params.set('name', leadContext.name);
  if (leadContext?.email) params.set('email', leadContext.email);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// ==================== WEBHOOK HANDLERS ====================

export async function handleCalcomWebhook(payload: any) {
  const eventType = payload.triggerEvent;
  const booking = payload.payload;

  if (!booking) return;

  // Try to find lead by email
  const attendeeEmail = booking.attendees?.[0]?.email;
  let lead = null;
  if (attendeeEmail) {
    lead = await db.lead.findFirst({
      where: { email: attendeeEmail },
    });
  }

  switch (eventType) {
    case 'BOOKING_CREATED': {
      if (lead) {
        await db.lead.update({
          where: { id: lead.id },
          data: { leadStatus: 'booked' },
        });

        await db.task.create({
          data: {
            organizationId: lead.organizationId,
            leadId: lead.id,
            taskType: 'call_prep',
            title: `Call with ${lead.fullName} — ${new Date(booking.startTime).toLocaleDateString()}`,
            description: `Meeting booked via Cal.com. Prepare call brief.`,
            dueAt: new Date(booking.startTime),
            status: 'pending',
            source: 'calcom_webhook',
          },
        });

        // Trigger call brief generation
        await emitEvent('openclaw.job_requested', {
          leadId: lead.id,
          workflowType: 'hot_lead_call_brief',
          organizationId: lead.organizationId,
        });

        await writeAuditLog({
          organizationId: lead.organizationId,
          entityType: 'booking',
          entityId: lead.id,
          action: 'booking_created',
          metadata: { startTime: booking.startTime, email: attendeeEmail },
        });
      }
      break;
    }

    case 'BOOKING_CANCELLED': {
      if (lead) {
        await db.lead.update({
          where: { id: lead.id },
          data: { leadStatus: 'contacted' },
        });

        // Reactivate outreach
        const activeCampaignLeads = await db.campaignLead.findMany({
          where: { leadId: lead.id, status: { in: ['completed', 'paused'] } },
        });
        for (const cl of activeCampaignLeads) {
          await db.campaignLead.update({
            where: { id: cl.id },
            data: { status: 'active' },
          });
        }

        await writeAuditLog({
          organizationId: lead.organizationId,
          entityType: 'booking',
          entityId: lead.id,
          action: 'booking_cancelled',
        });
      }
      break;
    }

    case 'NO_SHOW': {
      if (lead) {
        // Fire score decay
        await emitEvent('lead.score_decayed', { leadId: lead.id });

        await writeAuditLog({
          organizationId: lead.organizationId,
          entityType: 'booking',
          entityId: lead.id,
          action: 'no_show',
        });
      }
      break;
    }

    case 'BOOKING_RESCHEDULED': {
      if (lead) {
        // Update task due date
        const task = await db.task.findFirst({
          where: { leadId: lead.id, taskType: 'call_prep', status: 'pending' },
          orderBy: { createdAt: 'desc' },
        });
        if (task) {
          await db.task.update({
            where: { id: task.id },
            data: { dueAt: new Date(booking.startTime) },
          });
        }

        await writeAuditLog({
          organizationId: lead.organizationId,
          entityType: 'booking',
          entityId: lead.id,
          action: 'booking_rescheduled',
          metadata: { newTime: booking.startTime },
        });
      }
      break;
    }
  }
}
