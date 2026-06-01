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

export type DeletionScope = 'service' | 'account';

export type AccountDeletionResult = {
  readonly ok: true;
  readonly scope: DeletionScope;
  /** Plugin slug for service scope; 'all-services' for account scope. */
  readonly serviceName: string;
  readonly status: 'completed';
  readonly requestedAtIso: string;
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

/** Insert the canonical account_deletion_events row inside the same transaction. */
async function recordEvent(
  client: PoolClient,
  userId: string,
  scope: DeletionScope,
  serviceName: string,
  tables: readonly DeletionTableResult[],
): Promise<string> {
  const summary = {
    tables: tables.map((t) => ({ table: t.table, action: t.action, rowCount: t.rowCount })),
  };
  const inserted = await client.query<{ requested_at: Date }>(
    `INSERT INTO account_deletion_events
       (user_id, scope, service_name, requested_at, completed_at, status, summary)
     VALUES ($1, $2, $3, NOW(), NOW(), 'completed', $4::jsonb)
     RETURNING requested_at`,
    [userId, scope, serviceName, JSON.stringify(summary)],
  );
  return inserted.rows[0].requested_at.toISOString();
}

/**
 * Delete one plugin's data for a user. Throws `ServiceScopeNotSupportedError` if the plugin is not
 * service-scoped (e.g. ServiceCredits, GDP, Weekly Performance), so callers can return a clear 4xx.
 */
export async function deleteServiceScopeData(
  slug: string,
  userId: string,
): Promise<AccountDeletionResult> {
  const entry = getDeletionEntry(slug);
  if (!entry || !entry.serviceScopeSupported) {
    throw new ServiceScopeNotSupportedError(slug);
  }

  try {
    const { requestedAtIso, tables } = await withDbTransaction(async (client) => {
      const tableResults = await executeEntry(client, entry, userId);
      const iso = await recordEvent(client, userId, 'service', entry.slug, tableResults);
      return { requestedAtIso: iso, tables: tableResults };
    });

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

    return { ok: true, scope: 'service', serviceName: entry.slug, status: 'completed', requestedAtIso, tables };
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
 * order; within each plugin, tables run child-before-parent. Returns the combined per-table
 * results. Money settlement (ServiceCredits reclaim) is handled separately by the caller.
 */
export async function deleteAllAccountData(userId: string): Promise<AccountDeletionResult> {
  try {
    const { requestedAtIso, tables } = await withDbTransaction(async (client) => {
      const allResults: DeletionTableResult[] = [];
      for (const entry of accountDeletionRegistry as readonly PluginDeletionEntry[]) {
        const entryResults = await executeEntry(client, entry, userId);
        allResults.push(...entryResults);
      }
      const iso = await recordEvent(client, userId, 'account', 'all-services', allResults);
      return { requestedAtIso: iso, tables: allResults };
    });

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

    return { ok: true, scope: 'account', serviceName: 'all-services', status: 'completed', requestedAtIso, tables };
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
