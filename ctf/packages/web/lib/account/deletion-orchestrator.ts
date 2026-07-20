// Account deletion orchestrator — the one place that actually carries out a user's deletion request
// across plugins, driven entirely by the account deletion registry.
//
// Two entry points:
//   - `deleteServiceScopeData(slug, userId)` — delete just one plugin's data for this user.
//   - `deleteAllAccountData(userId)` — delete every plugin's data for this user (whole account).
//
// Both run the registry-derived plan inside a single `withDbTransaction`, so a failure rolls the
// whole thing back rather than leaving a user half-deleted. Each run records one
// `account_deletion_events` row (the retained accountability record) and logs an audit line.
//
// Money is deliberately out of scope here. ServiceCredits wallets/ledgers are `retain` in the
// registry and are settled by the existing reclaim flow (`markFullAccountDeletionRequested` →
// `enqueueServiceCreditsDeletionReclaim` → the service-credits adapter outbox). The full-account
// route calls that reclaim flow alongside this orchestrator; this file never moves credits.

import type { PoolClient } from 'pg';
import { withDbTransaction } from 'lib/db/postgres';
import { logAccountAudit } from './audit';
import {
  accountDeletionRegistry,
  getDeletionEntry,
  type PluginDeletionEntry,
} from './deletion-registry';
import { executeEntry, type DeletionTableResult } from './deletion-engine';
import { getExternalCleanup } from './external-cleanup-registry';
import { reportError } from 'lib/observability/report';

/**
 * Run external-store cleanups (e.g. Stream chat copies) for the given plugin slugs, AFTER the DB
 * transaction has committed. Best-effort and isolated: each cleanup is awaited in its own try/catch,
 * so one plugin's failure (or a Stream outage) is logged via `reportError` but never throws, never
 * blocks the others, and never rolls back the deletion the user already completed in the DB.
 */
async function runExternalCleanups(userId: string, slugs: readonly string[]): Promise<void> {
  for (const slug of slugs) {
    const cleanup = getExternalCleanup(slug);
    if (!cleanup) {
      continue;
    }
    try {
      await cleanup(userId);
    } catch (error) {
      reportError(error, { area: 'account', op: 'external_cleanup', extra: { slug, userId } });
    }
  }
}

export type DeletionScope = 'service' | 'account';

export type AccountDeletionResult = {
  readonly ok: true;
  readonly scope: DeletionScope;
  /** Plugin slug for service scope; 'all-services' for account scope. */
  readonly serviceName: string;
  readonly status: 'completed';
  /** When the deletion was requested. For a service delete this equals the completion time. */
  readonly requestedAtIso: string;
  /** When the deletion finished (the row's `completed_at`). */
  readonly completedAtIso: string;
  /** Per-table row counts, for the caller and the audit record. */
  readonly tables: readonly DeletionTableResult[];
};

/** Error thrown when a service-scope deletion targets a plugin that has no standalone delete. */
export class ServiceScopeNotSupportedError extends Error {
  constructor(public readonly slug: string) {
    super(`Plugin "${slug}" does not support standalone service-scope deletion.`);
    this.name = 'ServiceScopeNotSupportedError';
  }
}

/** Error thrown when a service-scope deletion targets a slug that is not in the registry at all. */
export class UnknownServiceError extends Error {
  constructor(public readonly slug: string) {
    super(`Unknown service "${slug}".`);
    this.name = 'UnknownServiceError';
  }
}

/**
 * Insert the canonical account_deletion_events row inside the same transaction.
 *
 * `requestedAtIso` is the real moment the deletion was requested — for a full-account deletion the
 * caller passes the timestamp from `markFullAccountDeletionRequested`; for a standalone service
 * delete there is no earlier request step, so it defaults to now. `completed_at` is always stamped
 * `NOW()`. Returns both timestamps so the API can report them with correct semantics.
 */
async function recordEvent(
  client: PoolClient,
  userId: string,
  scope: DeletionScope,
  serviceName: string,
  tables: readonly DeletionTableResult[],
  requestedAtIso?: string,
): Promise<{ requestedAtIso: string; completedAtIso: string }> {
  const summary = {
    tables: tables.map((t) => ({ table: t.table, action: t.action, rowCount: t.rowCount })),
  };
  const inserted = await client.query<{ requested_at: Date; completed_at: Date }>(
    `INSERT INTO account_deletion_events
       (user_id, scope, service_name, requested_at, completed_at, status, summary)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), NOW(), 'completed', $5::jsonb)
     RETURNING requested_at, completed_at`,
    [userId, scope, serviceName, requestedAtIso ?? null, JSON.stringify(summary)],
  );
  const row = inserted.rows[0];
  return {
    requestedAtIso: row.requested_at.toISOString(),
    completedAtIso: row.completed_at.toISOString(),
  };
}

/**
 * Delete one plugin's data for a user. Throws `UnknownServiceError` if the slug is not in the
 * registry at all, or `ServiceScopeNotSupportedError` if it is known but not service-scoped (e.g.
 * ServiceCredits, GDP, Weekly Performance), so the route can map each to the right status. Both
 * rejections are audited with `status: 'deny'` so denied attempts leave a trail.
 */
export async function deleteServiceScopeData(
  slug: string,
  userId: string,
): Promise<AccountDeletionResult> {
  const entry = getDeletionEntry(slug);
  if (!entry) {
    logAccountAudit({
      command: 'account.data.delete.service',
      actorId: userId,
      status: 'deny',
      reason: 'unknown_service',
      scope: 'service',
      serviceName: slug,
      result: 'failure',
      errorCategory: 'not_found',
    });
    throw new UnknownServiceError(slug);
  }
  if (!entry.serviceScopeSupported) {
    logAccountAudit({
      command: 'account.data.delete.service',
      actorId: userId,
      status: 'deny',
      reason: 'service_scope_not_supported',
      scope: 'service',
      serviceName: entry.slug,
      result: 'failure',
      errorCategory: 'policy_denied',
    });
    throw new ServiceScopeNotSupportedError(slug);
  }

  try {
    const { result, tables } = await withDbTransaction(async (client) => {
      const tableResults = await executeEntry(client, entry, userId);
      const recorded = await recordEvent(client, userId, 'service', entry.slug, tableResults);
      return { result: recorded, tables: tableResults };
    });

    // DB rows are gone; clear this plugin's external-store copy (e.g. Stream chat) too, post-commit.
    await runExternalCleanups(userId, [entry.slug]);

    logAccountAudit({
      command: 'account.data.delete.service',
      actorId: userId,
      status: 'allow',
      reason: 'service_scope_confirmed',
      scope: 'service',
      serviceName: entry.slug,
      result: 'success',
      errorCategory: null,
      metadata: { tableCount: tables.length },
    });

    return {
      ok: true,
      scope: 'service',
      serviceName: entry.slug,
      status: 'completed',
      requestedAtIso: result.requestedAtIso,
      completedAtIso: result.completedAtIso,
      tables,
    };
  } catch (error) {
    logAccountAudit({
      command: 'account.data.delete.service',
      actorId: userId,
      status: 'allow',
      reason: 'service_scope_confirmed',
      scope: 'service',
      serviceName: entry.slug,
      result: 'failure',
      errorCategory: 'persistence_error',
    });
    throw error;
  }
}

/**
 * Delete every plugin's data for a user, in one transaction. Plugins are processed in registry
 * order; within each plugin, tables run child-before-parent. The single transaction gives clean
 * all-or-nothing semantics — a partial failure must not leave a user half-deleted, which matters
 * more here than transaction length (each user's per-plugin footprint is small). Money settlement
 * (ServiceCredits reclaim) is handled separately by the caller; `requestedAtIso` is the caller's
 * original request time, stamped onto the event alongside the completion time.
 */
export async function deleteAllAccountData(
  userId: string,
  requestedAtIso?: string,
): Promise<AccountDeletionResult> {
  try {
    const { result, tables } = await withDbTransaction(async (client) => {
      const allResults: DeletionTableResult[] = [];
      for (const entry of accountDeletionRegistry as readonly PluginDeletionEntry[]) {
        const entryResults = await executeEntry(client, entry, userId);
        allResults.push(...entryResults);
      }
      const recorded = await recordEvent(client, userId, 'account', 'all-services', allResults, requestedAtIso);
      return { result: recorded, tables: allResults };
    });

    // DB rows for every plugin are gone; clear each plugin's external-store copy (e.g. Stream chat)
    // too, post-commit. This is the single place that covers all whole-account entry points (the
    // full-account route, the internal delete route, and the Clerk webhook all call this).
    await runExternalCleanups(userId, accountDeletionRegistry.map((entry) => entry.slug));

    logAccountAudit({
      command: 'account.data.delete.full',
      actorId: userId,
      status: 'allow',
      reason: 'account_deletion_confirmed',
      scope: 'account',
      result: 'success',
      errorCategory: null,
      metadata: { tableCount: tables.length },
    });

    return {
      ok: true,
      scope: 'account',
      serviceName: 'all-services',
      status: 'completed',
      requestedAtIso: result.requestedAtIso,
      completedAtIso: result.completedAtIso,
      tables,
    };
  } catch (error) {
    logAccountAudit({
      command: 'account.data.delete.full',
      actorId: userId,
      status: 'allow',
      reason: 'account_deletion_confirmed',
      scope: 'account',
      result: 'failure',
      errorCategory: 'persistence_error',
    });
    throw error;
  }
}
