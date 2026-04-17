import pkg, { QueryResult } from 'pg';
const { Client } = pkg;

let client: InstanceType<typeof Client> | null = null;

export async function initializeDb(): Promise<void> {
  if (client) return;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    console.error('[PM MCP] Connected to database');
  } catch (error) {
    console.error('[PM MCP] Database connection failed:', error);
    throw error;
  }
}


export function getClient(): InstanceType<typeof Client> {
  if (!client) {
    throw new Error('Database not initialized. Call initializeDb() first.');
  }
  return client;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

export async function query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const c = getClient();
  return c.query(sql, params);
}
