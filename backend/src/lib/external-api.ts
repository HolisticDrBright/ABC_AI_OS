/**
 * Universal error handler for all external API calls.
 * Applies retry with exponential backoff, structured logging, and audit trail.
 */

import { writeAuditLog } from './audit.js';

export interface ExternalAPIError {
  service: string;
  operation: string;
  message: string;
  attempt: number;
  retryable: boolean;
}

export type Result<T, E = ExternalAPIError> =
  | { success: true; data: T }
  | { success: false; error: E };

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode;
  if (status === 429 || status === 503 || status === 502 || status === 504) return true;
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') return true;
  if (error.message?.includes('fetch failed') || error.message?.includes('network')) return true;
  return false;
}

export async function callExternalAPI<T>(
  serviceName: string,
  operation: string,
  fn: () => Promise<T>,
  options: { retries?: number; backoffMs?: number; organizationId?: string } = {},
): Promise<Result<T>> {
  const { retries = 3, backoffMs = 1000 } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (error: any) {
      const isLast = attempt === retries;
      const retryable = isRetryableError(error);

      console.warn(
        `[${serviceName}.${operation}] attempt ${attempt}/${retries} failed: ${error.message}`,
        { retryable },
      );

      if (isLast || !retryable) {
        await writeAuditLog({
          organizationId: options.organizationId,
          entityType: serviceName,
          action: `${operation}_failed`,
          metadata: {
            error: error.message,
            attempt,
            retryable,
          },
        });

        return {
          success: false,
          error: {
            service: serviceName,
            operation,
            message: error.message,
            attempt,
            retryable,
          },
        };
      }

      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt - 1)));
    }
  }

  return {
    success: false,
    error: { service: serviceName, operation, message: 'Max retries exceeded', attempt: retries, retryable: false },
  };
}

// Circuit breaker for AI services
let consecutiveFailures = 0;
let circuitOpen = false;
let circuitOpenedAt = 0;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60000; // 1 minute

export function checkCircuitBreaker(): boolean {
  if (!circuitOpen) return true;
  if (Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
    circuitOpen = false;
    consecutiveFailures = 0;
    console.log('[CircuitBreaker] Circuit reset — retrying AI calls');
    return true;
  }
  return false;
}

export function recordAISuccess() {
  consecutiveFailures = 0;
  if (circuitOpen) {
    circuitOpen = false;
    console.log('[CircuitBreaker] Circuit closed — AI calls recovered');
  }
}

export function recordAIFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_THRESHOLD && !circuitOpen) {
    circuitOpen = true;
    circuitOpenedAt = Date.now();
    console.error(`[CircuitBreaker] OPEN — ${consecutiveFailures} consecutive AI failures. Pausing AI calls for ${CIRCUIT_RESET_MS / 1000}s`);
  }
}

export function getCircuitBreakerStatus() {
  return { circuitOpen, consecutiveFailures, circuitOpenedAt };
}
