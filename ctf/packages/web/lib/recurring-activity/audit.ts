import { queryDb } from 'lib/db/postgres';

// Append one Recurring Activity audit row (allow + deny). No sensitive raw payload is stored — only
// coarse metadata (sector, currency code, cadence, status transition). A failed audit write is
// reported by the caller but never changes the member's response.
export async function logRecurringActivityAuditEvent({
  actorUserId,
  command,
  policyStatus,
  reason,
  activityId,
  requestId,
  traceId,
  metadata = {},
}: {
  actorUserId?: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  activityId?: string;
  requestId?: string;
  // Distributed-trace correlation id, distinct from requestId. Required by the audit contract so a
  // single audit row can be tied to the wider trace that produced it.
  traceId?: string;
  metadata?: Record<string, unknown>;
}) {
  await queryDb(
    `INSERT INTO recurring_activity_audit_trail
       (actor_user_id, command, policy_status, reason, activity_id, request_id, trace_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      actorUserId ?? null,
      command,
      policyStatus,
      reason,
      activityId ?? null,
      requestId ?? null,
      traceId ?? null,
      JSON.stringify(metadata),
    ],
  );
}
