/**
 * Resend — Internal email notifications to agents only.
 * NOT for lead outreach (that goes through FUB Action Plans).
 */

import { config } from '../lib/config.js';
import { callExternalAPI } from '../lib/external-api.js';
import { writeAuditLog } from '../lib/audit.js';

const RESEND_BASE = 'https://api.resend.com';

interface ResendEmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(payload: ResendEmailPayload): Promise<{ id: string }> {
  const apiKey = (config as any).resend?.apiKey;
  if (!apiKey) throw new Error('Resend API key not configured');

  const res = await fetch(`${RESEND_BASE}/emails`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }

  return res.json();
}

const fromEmail = () => (config as any).resend?.fromEmail || 'noreply@abc-ai-os.com';

// ==================== AGENT DIGEST ====================

export interface DigestPayload {
  hotLeads: number;
  newReplies: number;
  pendingTasks: number;
  campaignsSummary: string;
  topAction: string;
}

export async function sendAgentDigest(agentEmail: string, digest: DigestPayload): Promise<void> {
  const result = await callExternalAPI('resend', 'send_digest', async () => {
    return sendEmail({
      from: fromEmail(),
      to: agentEmail,
      subject: `[ABC AI OS] Daily Digest — ${digest.hotLeads} hot leads, ${digest.newReplies} replies`,
      html: `
        <div style="font-family: monospace; background: #0a0a0f; color: #e8e8f0; padding: 24px;">
          <h2 style="color: #3b82f6;">ABC AI OS — Daily Digest</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #8888a0;">Hot Leads</td><td style="font-weight: bold;">${digest.hotLeads}</td></tr>
            <tr><td style="padding: 8px 0; color: #8888a0;">New Replies</td><td style="font-weight: bold;">${digest.newReplies}</td></tr>
            <tr><td style="padding: 8px 0; color: #8888a0;">Pending Tasks</td><td style="font-weight: bold;">${digest.pendingTasks}</td></tr>
            <tr><td style="padding: 8px 0; color: #8888a0;">Top Action</td><td>${digest.topAction}</td></tr>
          </table>
          <p style="color: #55556a; margin-top: 16px;">${digest.campaignsSummary}</p>
        </div>
      `,
    });
  });

  if (result.success) {
    await writeAuditLog({
      entityType: 'email',
      action: 'digest_sent',
      metadata: { to: agentEmail, resendId: result.data.id },
    });
  }
}

// ==================== ESCALATION ALERT ====================

export async function sendEscalationAlert(
  agentEmail: string,
  leadName: string,
  reason: string,
  threadPreview: string,
): Promise<void> {
  const result = await callExternalAPI('resend', 'send_escalation', async () => {
    return sendEmail({
      from: fromEmail(),
      to: agentEmail,
      subject: `[ABC AI OS] Escalation: ${leadName} needs attention`,
      html: `
        <div style="font-family: monospace; background: #0a0a0f; color: #e8e8f0; padding: 24px;">
          <h2 style="color: #f59e0b;">Escalation Alert</h2>
          <p><strong>Lead:</strong> ${leadName}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <div style="background: #1a1a24; padding: 12px; border-radius: 8px; margin-top: 12px;">
            <p style="color: #8888a0; margin: 0 0 8px;">Recent thread:</p>
            <p style="white-space: pre-wrap;">${threadPreview}</p>
          </div>
          <p style="margin-top: 16px;">Log in to ABC AI OS to respond.</p>
        </div>
      `,
    });
  });

  if (result.success) {
    await writeAuditLog({
      entityType: 'email',
      action: 'escalation_alert_sent',
      metadata: { to: agentEmail, leadName, resendId: result.data.id },
    });
  }
}

// ==================== SYSTEM NOTIFICATION ====================

export async function sendSystemNotification(
  userEmail: string,
  subject: string,
  message: string,
): Promise<void> {
  await callExternalAPI('resend', 'send_notification', async () => {
    return sendEmail({
      from: fromEmail(),
      to: userEmail,
      subject: `[ABC AI OS] ${subject}`,
      html: `
        <div style="font-family: monospace; background: #0a0a0f; color: #e8e8f0; padding: 24px;">
          <h2 style="color: #3b82f6;">${subject}</h2>
          <p>${message}</p>
        </div>
      `,
    });
  });
}
