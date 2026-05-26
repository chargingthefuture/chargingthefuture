import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

let publicPool: Pool | null = null;
let demoPool: Pool | null = null;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL is required for Chyme persistence routes.');
  }

  return databaseUrl;
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
      connectionString: getDatabaseUrl(),
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
  try {
    const { isDemoMode } = await import('../feature-flags/system');
    if (await isDemoMode()) {
      return getDemoPool();
    }
  } catch {
    // No request scope / flag layer unavailable (e.g. seed scripts) → public.
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
