import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
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

// The durable half. logMutualTimeAudit above writes a line to the server's log, which is useful
// while debugging and is not a record: nothing can query it, no screen can show it, and it ages out
// of the host's retention window. Owner directive 2026-08-28 — every admin action is recorded, on
// every surface — so an admin mutation writes a row as well, and this is the one function that does
// both. Opening an event and closing one decide what members can put their time into.
//
// It never throws. An audit write that failed would otherwise turn a completed close into a 503, and
// an admin repeating a close they have already made is worse than a gap in the trail. A failure is
// reported through the observability channel instead, and the log line still carries the event.
export async function recordMutualTimeAdminAudit(event: MutualTimeAuditEvent): Promise<void> {
  logMutualTimeAudit(event);
  // The target is one of eventId / slug / voteId; whichever is set names both the kind of thing
  // acted on and which one, so the row reads without the caller saying it twice.
  const [targetType, targetId] = Object.entries(event.target).find(
    ([, value]) => typeof value === 'string' && value.length > 0,
  ) ?? ['mutual_time_event', ''];
  try {
    await queryDb(
      `
        INSERT INTO mutual_time_admin_audit_trail
          (actor_id, command, policy_status, reason, target_type, target_id, result, error_category, metadata)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        event.actorId,
        event.command,
        event.status,
        event.reason,
        targetType,
        String(targetId ?? ''),
        event.result,
        event.errorCategory,
        JSON.stringify(event.evidence ? { evidence: event.evidence } : {}),
      ],
    );
  } catch (error) {
    reportError(error, { area: 'mutual-time', op: 'admin_audit_write' });
  }
}

// One row of mutual_time_admin_audit_trail, as the Audit log panel reads it.
export type MutualTimeAuditRow = {
  id: string;
  actor_id: string;
  command: string;
  policy_status: string;
  reason: string;
  target_type: string;
  target_id: string;
  result: string;
  error_category: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listMutualTimeAdminAuditEvents(limit = 100): Promise<MutualTimeAuditRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const result = await queryDb<MutualTimeAuditRow>(
    `
      SELECT id, actor_id, command, policy_status, reason, target_type, target_id,
             result, error_category, metadata, created_at
      FROM mutual_time_admin_audit_trail
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows;
}
