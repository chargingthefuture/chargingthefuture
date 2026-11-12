import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

let publicPool: Pool | null = null;
let demoPool: Pool | null = null;

// Request-scoped override that pins EVERY query in the wrapped callback to a
// specific schema, ignoring the usual demo account list. This is for
// trusted server-only operations that must act on a chosen schema regardless of
// (or in the absence of) a signed-in caller — e.g. the operator account-delete
// route, which runs with a bearer secret and no Clerk session, and must be able
// to delete a DEMO account's rows even though an internal call would otherwise
// always resolve to the public pool. AsyncLocalStorage makes this concurrency-safe
// (each request carries its own store) rather than a shared mutable global.
type ForcedPoolTarget = 'demo' | 'public';
const forcedPoolStore = new AsyncLocalStorage<ForcedPoolTarget>();

// Run `fn` with every DB query pinned to the chosen schema's pool. Trusted callers
// only — this bypasses the demo account list by design.
export function runWithForcedPool<T>(target: ForcedPoolTarget, fn: () => Promise<T>): Promise<T> {
  return forcedPoolStore.run(target, fn);
}

// The schema a surrounding runWithForcedPool pinned this work to, or null when nothing did. Read-only,
// so another integration can follow the same choice the database queries follow: the Stream
// credentials do, so a deletion pinned to the demo schema clears the demo Stream app and never the
// production one.
export function getForcedPoolTarget(): ForcedPoolTarget | null {
  return forcedPoolStore.getStore() ?? null;
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL is required for Chyme persistence routes.');
  }

  return databaseUrl;
}

// Neon's PgBouncer pooler rejects session-level startup params (e.g. search_path).
// The demo pool needs search_path=demo,public; use the direct connection for it.
// DATABASE_URL_DIRECT = unpooled Neon endpoint (same credentials, no -pooler in host).
// Falls back to DATABASE_URL when not set (works on non-Neon Postgres or direct URLs).
function getDemoDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL_DIRECT;
  if (direct && direct.trim().length > 0) return direct;
  return getDatabaseUrl();
}

function getPublicPool(): Pool {
  if (!publicPool) {
    publicPool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  return publicPool;
}

// Demo participants (accounts on the demo account list) are routed to the `demo` schema:
// a parallel copy of every table in the SAME database, seeded with synthetic data
// (#102). The connection pins search_path to `demo` (with `public` only as a
// fallback for shared objects like extensions/functions), so a missing demo table
// fails the query rather than silently reading/writing production rows — demo data
// can never leak into prod, and vice versa. Provision with `pnpm migrate:demo-schema`.
function getDemoPool(): Pool {
  if (!demoPool) {
    demoPool = new Pool({
      connectionString: getDemoDatabaseUrl(),
      ssl: {
        rejectUnauthorized: false,
      },
      options: '-c search_path=demo,public',
    });
  }

  return demoPool;
}

// Selects the pool for the current request. A pin (runWithForcedPool) decides first, so a
// signed-out read pinned to `demo` (the signed-out Today sample) still reaches the demo schema.
// Otherwise an account switched to demo data on the Unlock admin (public.demo_mode_accounts,
// lib/demo-mode/demo-accounts.ts) gets the demo pool and everybody else the public pool. That
// module is imported lazily so plain-node consumers (seed scripts, migrations) never pull Next-only
// deps into their import graph; if it can't load or there is no request scope, we use public.
async function getActivePool(): Promise<Pool> {
  // An explicit forced target (runWithForcedPool) wins over the demo account list —
  // it is the authoritative choice made by a trusted operator path.
  const forced = forcedPoolStore.getStore();
  if (forced === 'demo') {
    return getDemoPool();
  }
  if (forced === 'public') {
    return getPublicPool();
  }

  try {
    const { isDemoMode } = await import('../demo-mode/demo-accounts');
    if (await isDemoMode()) {
      return getDemoPool();
    }
  } catch {
    // no-trace: no request scope or demo account module (a seed script, say), so the public pool is right.
  }

  return getPublicPool();
}

export async function queryDb<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  const pool = await getActivePool();
  return pool.query<T>(text, values as unknown[]);
}

// The reporter is loaded lazily for the same reason as the demo account module above: plain-node
// consumers of this module must not pull Sentry's Next.js package into their import graph.
async function reportRollbackFailure(error: Error): Promise<void> {
  try {
    const { reportError } = await import('../observability/report');
    reportError(error, { area: 'db', op: 'transaction_rollback' });
  } catch (importError) {
    console.error('[withDbTransaction] ROLLBACK failed and the error reporter could not load:', error, importError);
  }
}

export async function withDbTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const dbPool = await getActivePool();
  const client = await dbPool.connect();

  // Set when ROLLBACK itself fails. Passed to release() so pg discards the client instead of
  // returning it to the pool with a transaction that may never have ended.
  let rollbackError: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (caught) {
      // The error that started this is the one the caller needs; the rollback failure is reported
      // on its own so it is not lost either.
      rollbackError = caught instanceof Error ? caught : new Error(String(caught));
      await reportRollbackFailure(rollbackError);
    }
    throw error;
  } finally {
    client.release(rollbackError);
  }
}
