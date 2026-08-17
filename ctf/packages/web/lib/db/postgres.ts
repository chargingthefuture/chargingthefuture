import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

let publicPool: Pool | null = null;
let demoPool: Pool | null = null;

// Request-scoped override that pins EVERY query in the wrapped callback to a
// specific schema, ignoring the usual per-user demo-mode targeting. This is for
// trusted server-only operations that must act on a chosen schema regardless of
// (or in the absence of) a signed-in caller — e.g. the operator account-delete
// route, which runs with a bearer secret and no Clerk session, and must be able
// to delete a DEMO account's rows even though an internal call would otherwise
// always resolve to the public pool. AsyncLocalStorage makes this concurrency-safe
// (each request carries its own store) rather than a shared mutable global.
type ForcedPoolTarget = 'demo' | 'public';
const forcedPoolStore = new AsyncLocalStorage<ForcedPoolTarget>();

// Run `fn` with every DB query pinned to the chosen schema's pool. Trusted callers
// only — this bypasses demo-mode access control by design.
export function runWithForcedPool<T>(target: ForcedPoolTarget, fn: () => Promise<T>): Promise<T> {
  return forcedPoolStore.run(target, fn);
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

// Demo participants (per-user demo-mode targeting) are routed to the `demo` schema:
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

// Selects the pool for the current request. Demo-mode is a per-user Unleash
// targeting allowlist; when no one is a participant this always returns the public
// pool — identical to prior behavior. The feature-flag layer is imported lazily so
// plain-node consumers (seed scripts, migrations) never pull Next-only deps into
// their import graph; if it can't load or there is no request scope, we use public.
async function getActivePool(): Promise<Pool> {
  // An explicit forced target (runWithForcedPool) wins over demo-mode targeting —
  // it is the authoritative choice made by a trusted operator path.
  const forced = forcedPoolStore.getStore();
  if (forced === 'demo') {
    return getDemoPool();
  }
  if (forced === 'public') {
    return getPublicPool();
  }

  try {
    const { isDemoMode } = await import('../feature-flags/system');
    if (await isDemoMode()) {
      return getDemoPool();
    }
  } catch {
    // no-trace: no request scope or flag layer (a seed script, say), so the public pool is right.
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

export async function withDbTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const dbPool = await getActivePool();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
