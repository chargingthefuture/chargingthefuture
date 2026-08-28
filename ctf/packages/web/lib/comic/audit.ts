import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';

type ComicAuditEvent = {
  actorId: string;
  pluginId: 'comic';
  command: string;
  status: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'failure';
  errorCategory: string | null;
  metadata?: Record<string, unknown>;
};

export function logComicAudit(event: ComicAuditEvent): void {
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
    },
    targetContext: {
      targetType: event.targetType,
      targetId: event.targetId,
    },
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
    metadata: event.metadata ?? {},
  };

  console.info('[comic.audit]', JSON.stringify(payload));
}

// The durable half. logComicAudit above writes a line to the server's log, which is useful while
// debugging and is not a record: nothing can query it, no screen can show it, and it ages out of the
// host's retention window. Owner directive 2026-08-28 — every admin action is recorded, on every
// surface — so an admin mutation writes a row as well, and this is the one function that does both.
// These are decisions about other people's contributions, which is exactly the kind of decision that
// has to be readable afterwards.
//
// It never throws. An audit write that failed would otherwise turn a completed decision into a 503,
// and a reviewer repeating an accept or decline they have already made is worse than a gap in the
// trail. A failure is reported through the observability channel instead, and the log line still
// carries the event.
export async function recordComicAdminAudit(event: ComicAuditEvent): Promise<void> {
  logComicAudit(event);
  try {
    await queryDb(
      `
        INSERT INTO comic_admin_audit_trail
          (actor_id, command, policy_status, reason, target_type, target_id, result, error_category, metadata)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        event.actorId,
        event.command,
        event.status,
        event.reason,
        event.targetType,
        event.targetId,
        event.result,
        event.errorCategory,
        JSON.stringify(event.metadata ?? {}),
      ],
    );
  } catch (error) {
    reportError(error, { area: 'comic', op: 'admin_audit_write' });
  }
}

// One row of comic_admin_audit_trail, as the Audit log panel reads it.
export type ComicAuditRow = {
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

export async function listComicAdminAuditEvents(limit = 100): Promise<ComicAuditRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const result = await queryDb<ComicAuditRow>(
    `
      SELECT id, actor_id, command, policy_status, reason, target_type, target_id,
             result, error_category, metadata, created_at
      FROM comic_admin_audit_trail
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows;
}
