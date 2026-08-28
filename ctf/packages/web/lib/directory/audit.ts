import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';

type DirectoryAuditEvent = {
  actorId: string;
  command: string;
  status: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'failure';
  errorCategory: string | null;
  metadata?: Record<string, unknown>;
  // The audit contract (DIRECTORY_PLUGIN_AUDIT_CONTRACTS.yaml) requires a workspaceId in
  // targetContext and a top-level requestId + traceId on every event, for cross-service
  // correlation and compliance tracing. They are optional on the call site so existing
  // callers keep compiling; when a caller does not pass them the helper records 'unknown'
  // rather than dropping the field, so the serialized payload always matches the schema shape.
  workspaceId?: string | null;
  requestId?: string | null;
  traceId?: string | null;
};

export function logDirectoryAudit(event: DirectoryAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: 'directory',
    command: event.command,
    commandVersion: '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
    },
    targetContext: {
      workspaceId: event.workspaceId ?? 'unknown',
      targetType: event.targetType,
      targetId: event.targetId,
    },
    requestId: event.requestId ?? 'unknown',
    traceId: event.traceId ?? 'unknown',
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
    metadata: event.metadata ?? {},
  };

  console.info('[directory.audit]', JSON.stringify(payload));
}

// The durable half. logDirectoryAudit above writes a line to the server's log, which is useful while
// debugging and is not a record: nothing can query it, no screen can show it, and it ages out of the
// host's retention window. Owner directive 2026-08-28 — every admin action is recorded, on every
// surface — so an admin mutation writes a row as well, and this is the one function that does both.
//
// It never throws. An audit write that failed would otherwise turn a completed takedown into a 503,
// and an admin retrying a destructive action they have already performed is worse than a gap in the
// trail. A failure is reported through the observability channel instead, and the log line above
// still carries the event.
export async function recordDirectoryAdminAudit(event: DirectoryAuditEvent): Promise<void> {
  logDirectoryAudit(event);
  try {
    await queryDb(
      `
        INSERT INTO directory_admin_audit_trail
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
    reportError(error, { area: 'directory', op: 'admin_audit_write' });
  }
}

// One row of directory_admin_audit_trail, as the Audit log tab reads it.
export type DirectoryAuditRow = {
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

export async function listDirectoryAdminAuditEvents(limit = 100): Promise<DirectoryAuditRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const result = await queryDb<DirectoryAuditRow>(
    `
      SELECT id, actor_id, command, policy_status, reason, target_type, target_id,
             result, error_category, metadata, created_at
      FROM directory_admin_audit_trail
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows;
}
