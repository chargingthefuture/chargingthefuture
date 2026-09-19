import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
import { logChymeAudit } from './audit';
import type { ChymeAuditEvent } from './types';

// The durable half of a Chyme admin action's record. `logChymeAudit` writes the contract-shaped
// event to the server's log, which is useful while debugging and is not a record: nothing can query
// it, no screen can show it, and it ages out of the host's retention window. Owner directive
// 2026-08-28 — every admin action is recorded, on every surface — so a moderation action writes a
// row in `chyme_admin_audit_trail` as well, in the same shape every other plugin's trail uses.
//
// It never throws. An audit write that failed would otherwise turn a completed removal into a 500,
// and an admin retrying an action they have already taken is worse than a gap in the trail; the
// failure is reported through the observability channel and the log line still carries the event.
export async function recordChymeAdminAudit(
  event: ChymeAuditEvent & { targetType: string; targetId: string; metadata?: Record<string, unknown> },
): Promise<void> {
  logChymeAudit(event);
  try {
    await queryDb(
      `
        INSERT INTO chyme_admin_audit_trail
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
    reportError(error, { area: 'chyme', op: 'admin_audit_write' });
  }
}
