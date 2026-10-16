// Retrying external-store cleanups that failed during a deletion (owner decision, 2026-10-16;
// issue #2703).
//
// A deletion removes the member's Postgres rows in one transaction, then clears each plugin's copy in
// an external store (Stream chat) after the commit. That second step is best-effort: a Stream outage
// must not undo a deletion that already happened. Before this, a failed cleanup went to error
// tracking only, every record said the deletion had finished, and the member's chat messages stayed
// in Stream with nobody able to see which accounts were affected.
//
// Now each failure is a row in account_external_cleanup_retries, and an hourly job
// (`.github/workflows/account-external-cleanup-retry.yml` → POST
// /api/internal/account/retry-external-cleanups) tries it again, waiting longer after each attempt,
// until it works or the attempts run out. A row is deleted the moment its cleanup succeeds, so the
// table holds only the accounts that still have a copy in Stream.
//
// The row holds the deleted account's id, the plugin slug and the failure reason, nothing the member
// wrote. Rows are written through the active pool, so a demo-schema deletion records its failure in
// the demo schema and is retried there, against the demo Stream app.
import { queryDb, runWithForcedPool } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
import { getExternalCleanup } from './external-cleanup-registry';

/** Attempts before a cleanup is given up on: about four days at the waits below. */
export const MAX_CLEANUP_ATTEMPTS = 12;

/** Rows tried per run, oldest first, so one run stays short. */
const RETRY_BATCH_LIMIT = 50;

/**
 * Hours to wait before the next attempt, after `attempts` failures: 1, 2, 4, 8, 16, then 24.
 * Long enough that an outage of a few hours passes, short enough that a copy does not sit for days.
 */
export function hoursUntilNextAttempt(attempts: number): number {
  return Math.min(2 ** Math.max(attempts - 1, 0), 24);
}

function failureText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 500);
}

/**
 * Record that a cleanup failed during a deletion, so the retry job picks it up. Never throws: the
 * deletion has already committed, and a failed write here is reported rather than turned into a
 * failed deletion. A second failure for the same account and plugin restarts its count.
 */
export async function recordExternalCleanupFailure(userId: string, slug: string, error: unknown): Promise<void> {
  try {
    await queryDb(
      `INSERT INTO account_external_cleanup_retries
         (user_id, slug, attempts, last_error, first_failed_at, last_attempt_at, next_attempt_at, given_up_at)
       VALUES ($1, $2, 1, $3, NOW(), NOW(), NOW() + make_interval(hours => $4), NULL)
       ON CONFLICT (user_id, slug) DO UPDATE
         SET attempts = 1,
             last_error = EXCLUDED.last_error,
             last_attempt_at = NOW(),
             next_attempt_at = EXCLUDED.next_attempt_at,
             given_up_at = NULL`,
      [userId, slug, failureText(error), hoursUntilNextAttempt(1)],
    );
  } catch (recordError) {
    reportError(recordError, { area: 'account', op: 'external_cleanup_record_failure', extra: { slug } });
  }
}

type RetryRow = { id: string; user_id: string; slug: string; attempts: number };

export type CleanupRetryCounts = {
  /** Rows that were due and tried this run. */
  tried: number;
  /** Tried and succeeded; the row is gone. */
  cleared: number;
  /** Tried and failed again; scheduled for another attempt. */
  stillFailing: number;
  /** Failed for the last allowed time this run; no further attempts. */
  gaveUp: number;
  /** Given up on in an earlier run and still in the table, for the owner to know about. */
  givenUpTotal: number;
};

async function markAttemptFailed(row: RetryRow, error: unknown): Promise<'stillFailing' | 'gaveUp'> {
  const attempts = row.attempts + 1;
  const givingUp = attempts >= MAX_CLEANUP_ATTEMPTS;
  await queryDb(
    `UPDATE account_external_cleanup_retries
        SET attempts = $2,
            last_error = $3,
            last_attempt_at = NOW(),
            next_attempt_at = NOW() + make_interval(hours => $4),
            given_up_at = CASE WHEN $5 THEN NOW() ELSE NULL END
      WHERE id = $1`,
    [row.id, attempts, failureText(error), hoursUntilNextAttempt(attempts), givingUp],
  );
  return givingUp ? 'gaveUp' : 'stillFailing';
}

/** Try every due cleanup in the active pool's schema once. */
async function retryDueInActiveSchema(): Promise<CleanupRetryCounts> {
  const counts: CleanupRetryCounts = { tried: 0, cleared: 0, stillFailing: 0, gaveUp: 0, givenUpTotal: 0 };
  const due = await queryDb<RetryRow>(
    `SELECT id::text AS id, user_id, slug, attempts
       FROM account_external_cleanup_retries
      WHERE given_up_at IS NULL AND next_attempt_at <= NOW()
      ORDER BY next_attempt_at ASC
      LIMIT $1`,
    [RETRY_BATCH_LIMIT],
  );

  for (const row of due.rows) {
    counts.tried += 1;
    const cleanup = getExternalCleanup(row.slug);
    try {
      if (!cleanup) {
        throw new Error(`No external cleanup is registered for "${row.slug}" any more`);
      }
      await cleanup(row.user_id);
      await queryDb('DELETE FROM account_external_cleanup_retries WHERE id = $1', [row.id]);
      counts.cleared += 1;
    } catch (error) {
      counts[await markAttemptFailed(row, error)] += 1;
    }
  }

  const givenUp = await queryDb<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM account_external_cleanup_retries WHERE given_up_at IS NOT NULL',
  );
  counts.givenUpTotal = Number(givenUp.rows[0]?.count ?? 0);
  return counts;
}

export type CleanupRetryResult = {
  production: CleanupRetryCounts;
  /** Null when the demo schema has no copy of the table, or could not be read (the reason is reported). */
  demo: CleanupRetryCounts | null;
};

/**
 * Retry due cleanups in the production schema and then in the demo schema, each pinned to its own
 * pool so its Stream cleanup reaches the matching Stream app. A demo schema that cannot be read
 * (not provisioned in this environment) is reported and leaves the production result standing.
 */
export async function retryDueExternalCleanups(): Promise<CleanupRetryResult> {
  const production = await runWithForcedPool('public', retryDueInActiveSchema);
  let demo: CleanupRetryCounts | null = null;
  try {
    demo = await runWithForcedPool('demo', retryDueInDemoSchema);
  } catch (error) {
    reportError(error, { area: 'account', op: 'external_cleanup_retry_demo' });
  }
  return { production, demo };
}

/**
 * The demo pass, only when the demo schema has its own copy of the table. The demo connection's
 * search path falls back to `public`, so without this check a demo schema missing the table would
 * read the production rows and retry them against the demo Stream app.
 */
async function retryDueInDemoSchema(): Promise<CleanupRetryCounts | null> {
  const exists = await queryDb<{ found: boolean }>(
    "SELECT to_regclass('demo.account_external_cleanup_retries') IS NOT NULL AS found",
  );
  if (!exists.rows[0]?.found) {
    return null;
  }
  return retryDueInActiveSchema();
}
