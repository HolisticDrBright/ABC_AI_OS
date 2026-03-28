import { db } from './db.js';

export interface AuditEntry {
  organizationId?: string;
  userId?: string;
  entityType: string;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      userId: entry.userId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      metadataJson: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : undefined,
    },
  });
}
