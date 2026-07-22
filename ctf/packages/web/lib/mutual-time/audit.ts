import { randomUUID } from 'crypto';
import type { MutualTimeAuditEvent } from './types';

// Structured audit line for Mutual Time commands, mirroring the Chyme audit shape. Emitted to the
// application log (console.info) — the platform's log pipeline is the sink.
function buildTargetContext(target: MutualTimeAuditEvent['target']): Record<string, string> {
  return Object.entries(target).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function logMutualTimeAudit(event: MutualTimeAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: event.pluginId,
    command: event.command,
    commandVersion: '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
      ...(event.evidence ? { evidence: event.evidence } : {}),
    },
    targetContext: buildTargetContext(event.target),
    result: { status: event.result, errorCategory: event.errorCategory ?? 'none' },
  };
  console.info('[mutual-time.audit]', JSON.stringify(payload));
}
