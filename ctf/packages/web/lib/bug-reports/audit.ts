import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';

// Audit for the bug-report admin surface. Owner directive 2026-08-28: every admin action is
// recorded, on every surface, from the day the surface ships. This plugin had nothing at all — no
// table, no helper, not even a log line — so resolving a held report left no trace. That decision
// matters: 'release' sends the member's redacted report on to the triage repo, 'reject' drops it so
// it never goes anywhere, and the member is never told which happened.
//
// Unlike the other plugins' helpers, this one was written durable-first: there is no console-only
// predecessor to keep compatible with, so the row is the record and the log line rides along for
// debugging.
//
// What it deliberately does NOT record: the report body and the reporter. The body is the sensitive
// part — it is redacted before it ever leaves this app — so the trail names which report was decided
// and by whom, never what it said. Do not add a content or reporter column here.
export type BugReportAuditEvent = {
  actorId: string;
  command: 'bug-reports.admin.resolve';
  status: 'allow' | 'deny';
  reason: string;
  targetId: string;
  result: 'success' | 'failure';
  errorCategory: string | null;
  metadata?: Record<string, unknown>;
};

// It never throws. An audit write that failed would otherwise turn a completed resolve into a 503,
// and an admin repeating a reject they have already made is worse than a gap in the trail. A failure
// is reported through the observability channel instead, and the log line still carries the event.
export async function recordBugReportAdminAudit(event: BugReportAuditEvent): Promise<void> {
  console.info('[bug-reports.audit]', JSON.stringify({
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: 'bug-reports',
    command: event.command,
    commandVersion: '1.0.0',
    policyDecision: { status: event.status, reason: event.reason },
    targetContext: { targetType: 'bug_report', targetId: event.targetId },
    result: { status: event.result, errorCategory: event.errorCategory ?? 'none' },
    metadata: event.metadata ?? {},
  }));

  try {
    await queryDb(
      `
        INSERT INTO bug_report_admin_audit_trail
          (actor_id, command, policy_status, reason, target_type, target_id, result, error_category, metadata)
        VALUES
          ($1, $2, $3, $4, 'bug_report', $5, $6, $7, $8::jsonb)
      `,
      [
        event.actorId,
        event.command,
        event.status,
        event.reason,
        event.targetId,
        event.result,
        event.errorCategory,
        JSON.stringify(event.metadata ?? {}),
      ],
    );
  } catch (error) {
    reportError(error, { area: 'bug-reports', op: 'admin_audit_write' });
  }
}

// One row of bug_report_admin_audit_trail, as the Audit log panel reads it.
export type BugReportAuditRow = {
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

export async function listBugReportAdminAuditEvents(limit = 100): Promise<BugReportAuditRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const result = await queryDb<BugReportAuditRow>(
    `
      SELECT id, actor_id, command, policy_status, reason, target_type, target_id,
             result, error_category, metadata, created_at
      FROM bug_report_admin_audit_trail
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows;
}
