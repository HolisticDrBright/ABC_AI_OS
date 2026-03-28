import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config.js';

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

const queues = new Map<string, Queue>();

export type EventType =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.inbound_received'
  | 'lead.enriched'
  | 'lead.scored'
  | 'lead.score_decayed'
  | 'lead.segment_assigned'
  | 'lead.persona_memory_updated'
  | 'campaign.created'
  | 'campaign.lead_enrolled'
  | 'campaign.variant_assigned'
  | 'message.generated'
  | 'message.sent'
  | 'message.delivered'
  | 'message.failed'
  | 'message.no_response_threshold_reached'
  | 'inbound.reply_received'
  | 'reply.classified'
  | 'next_best_action.updated'
  | 'followupboss.sync_requested'
  | 'followupboss.synced'
  | 'openclaw.job_requested'
  | 'openclaw.job_completed'
  | 'openclaw.job_fallback_used'
  | 'task.created'
  | 'task.escalated'
  | 'neighborhood.data_refreshed';

function getQueue(eventType: string): Queue {
  if (!queues.has(eventType)) {
    queues.set(eventType, new Queue(eventType, { connection: getConnection() }));
  }
  return queues.get(eventType)!;
}

export async function emitEvent(eventType: EventType, payload: Record<string, unknown>): Promise<void> {
  const queue = getQueue(eventType);
  await queue.add(eventType, {
    eventType,
    payload,
    emittedAt: new Date().toISOString(),
  });
}

export function onEvent(
  eventType: EventType,
  handler: (payload: Record<string, unknown>) => Promise<void>,
): Worker {
  const worker = new Worker(
    eventType,
    async (job: Job) => {
      await handler(job.data.payload);
    },
    { connection: getConnection() },
  );

  worker.on('failed', (job, err) => {
    console.error(`[EventBus] Job failed on ${eventType}:`, err.message);
  });

  return worker;
}
