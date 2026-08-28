import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';

// One audit line per WhatWorks command, matching the declared events in
// docs/contracts/WHAT_WORKS_PLUGIN_AUDIT_CONTRACTS.yaml. Modeled on the directory/workforce
// audit helpers: a single structured console line that the platform log pipeline collects.

// Every WhatWorks command sits at contract version 1.0.0 today; kept as a map so a future
// per-command bump records the version that actually governed the call.
const WHAT_WORKS_COMMAND_VERSIONS: Record<string, string> = {
  'what-works.list.read': '1.0.0',
  'what-works.public.read': '1.0.0',
  'what-works.problems.list': '1.0.0',
  'what-works.product.suggest': '1.0.0',
  'what-works.product.endorse': '1.0.0',
  'what-works.product.unendorse': '1.0.0',
  'what-works.admin.problem.list': '1.0.0',
  'what-works.admin.problem.create': '1.0.0',
  'what-works.admin.problem.update': '1.0.0',
  'what-works.admin.problem.delete': '1.0.0',
  'what-works.admin.product.list': '1.0.0',
  'what-works.admin.product.review': '1.0.0',
  'what-works.admin.product.update': '1.0.0',
  'what-works.admin.product.delete': '1.0.0',
};

// The data classes each command touches, mirrored from the audit contract so the recorded
// line carries the same classification the contract declares.
const WHAT_WORKS_COMMAND_DATA_CLASSES: Record<string, string[]> = {
  'what-works.list.read': ['community_content'],
  'what-works.public.read': ['community_content'],
  'what-works.problems.list': ['community_content'],
  'what-works.product.suggest': ['community_content', 'user_event'],
  'what-works.product.endorse': ['user_event'],
  'what-works.product.unendorse': ['user_event'],
  'what-works.admin.problem.list': ['community_content'],
  'what-works.admin.problem.create': ['community_content'],
  'what-works.admin.problem.update': ['community_content'],
  'what-works.admin.problem.delete': ['community_content', 'user_event'],
  'what-works.admin.product.list': ['community_content'],
  'what-works.admin.product.review': ['community_content'],
  'what-works.admin.product.update': ['community_content'],
  'what-works.admin.product.delete': ['community_content', 'user_event'],
};

type WhatWorksAuditEvent = {
  // The acting member's id, or null for the unauthenticated public read.
  actorId: string | null;
  command: string;
  status: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'failure';
  errorCategory?: string | null;
  metadata?: Record<string, unknown>;
};

export function logWhatWorksAudit(event: WhatWorksAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId ?? 'anonymous',
    pluginId: 'what-works',
    command: event.command,
    commandVersion: WHAT_WORKS_COMMAND_VERSIONS[event.command] ?? '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
    },
    targetContext: {
      targetType: event.targetType,
      targetId: event.targetId,
    },
    dataClassesAccessed: WHAT_WORKS_COMMAND_DATA_CLASSES[event.command] ?? [],
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
    metadata: event.metadata ?? {},
  };

  console.info('[what-works.audit]', JSON.stringify(payload));
}

// The durable half. logWhatWorksAudit above writes a line to the server's log, which is useful while
// debugging and is not a record: nothing can query it, no screen can show it, and it ages out of the
// host's retention window. Owner directive 2026-08-28 — every admin action is recorded, on every
// surface — so an admin mutation writes a row as well, and this is the one function that does both.
// These are decisions about what members see recommended, and about suggestions members made.
//
// It never throws. An audit write that failed would otherwise turn a completed edit into a 503, and
// an admin repeating a removal they have already made is worse than a gap in the trail. A failure is
// reported through the observability channel instead, and the log line still carries the event.
export async function recordWhatWorksAdminAudit(event: WhatWorksAuditEvent): Promise<void> {
  logWhatWorksAudit(event);
  try {
    await queryDb(
      `
        INSERT INTO what_works_admin_audit_trail
          (actor_id, command, policy_status, reason, target_type, target_id, result, error_category, metadata)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        // Only an admin reaches this helper, so actorId is always set; the fallback matches the log
        // line's own rather than writing a null into a NOT NULL column.
        event.actorId ?? 'anonymous',
        event.command,
        event.status,
        event.reason,
        event.targetType,
        event.targetId,
        event.result,
        event.errorCategory ?? null,
        JSON.stringify(event.metadata ?? {}),
      ],
    );
  } catch (error) {
    reportError(error, { area: 'what-works', op: 'admin_audit_write' });
  }
}

// One row of what_works_admin_audit_trail, as the Audit log panel reads it.
export type WhatWorksAuditRow = {
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

export async function listWhatWorksAdminAuditEvents(limit = 100): Promise<WhatWorksAuditRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const result = await queryDb<WhatWorksAuditRow>(
    `
      SELECT id, actor_id, command, policy_status, reason, target_type, target_id,
             result, error_category, metadata, created_at
      FROM what_works_admin_audit_trail
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows;
}
