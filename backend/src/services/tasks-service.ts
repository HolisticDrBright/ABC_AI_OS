import { db } from '../lib/db.js';
import { emitEvent } from '../lib/event-bus.js';
import { writeAuditLog } from '../lib/audit.js';

// ==================== TASK MANAGEMENT ====================

export async function createEscalationTask(params: {
  organizationId: string;
  leadId: string;
  conversationId?: string;
  reason: string;
  assignedUserId?: string;
}) {
  const task = await db.task.create({
    data: {
      organizationId: params.organizationId,
      leadId: params.leadId,
      conversationId: params.conversationId,
      assignedUserId: params.assignedUserId,
      taskType: 'human_escalation',
      title: `Escalation: ${params.reason.substring(0, 80)}`,
      description: params.reason,
      status: 'pending',
      source: 'ai_classification',
      escalationSurface: 'mobile_handoff',
    },
  });

  await writeAuditLog({
    organizationId: params.organizationId,
    entityType: 'task',
    entityId: task.id,
    action: 'escalation_created',
    metadata: { reason: params.reason },
  });

  await emitEvent('task.created', {
    taskId: task.id,
    leadId: params.leadId,
    type: 'human_escalation',
  });

  return task;
}

export async function getTasks(organizationId: string, filters?: { status?: string; assignedUserId?: string }) {
  const where: any = { organizationId };
  if (filters?.status) where.status = filters.status;
  if (filters?.assignedUserId) where.assignedUserId = filters.assignedUserId;

  return db.task.findMany({
    where,
    include: {
      lead: { select: { id: true, fullName: true, phone: true, email: true } },
      conversation: { select: { id: true, threadStatus: true } },
      assignedUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function updateTaskStatus(taskId: string, organizationId: string, status: string, userId?: string) {
  const task = await db.task.findFirst({ where: { id: taskId, organizationId } });
  if (!task) throw new Error('Task not found');

  const updated = await db.task.update({
    where: { id: taskId },
    data: { status },
  });

  await writeAuditLog({
    organizationId,
    userId,
    entityType: 'task',
    entityId: taskId,
    action: 'status_changed',
    metadata: { from: task.status, to: status },
  });

  return updated;
}

// ==================== HUMAN ESCALATION VIEW DATA ====================

export async function getEscalationView(taskId: string, organizationId: string) {
  const task = await db.task.findFirst({
    where: { id: taskId, organizationId },
    include: {
      lead: {
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 20 },
          scores: { orderBy: { scoredAt: 'desc' }, take: 1 },
        },
      },
      conversation: {
        include: {
          classifications: { orderBy: { createdAt: 'desc' }, take: 3 },
        },
      },
    },
  });

  if (!task) throw new Error('Task not found');

  const latestClassification = task.conversation?.classifications?.[0];

  return {
    task,
    lead: task.lead,
    messages: task.lead?.messages || [],
    latestScore: task.lead?.scores?.[0],
    classification: latestClassification,
    suggestedReply: latestClassification?.suggestedReply,
    classificationReason: latestClassification?.suggestedAction,
  };
}
