import { describe, it, expect, vi } from 'vitest';

// The sign-in write is one SQL statement, so this reads the SQL the module sends rather than a
// database.
const executed: { sql: string; values: readonly unknown[] }[] = [];

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string, values: readonly unknown[] = []) => {
    executed.push({ sql, values });
    return { rows: [], rowCount: 1 };
  }),
}));

const { recordLoginEventNow } = await import('lib/engagement/login-activity');

describe('the sign-in write', () => {
  // Production's user_id is VARCHAR while schema.sql says TEXT. An uncast $1 is deduced as text in
  // the SELECT list and as varchar in the comparison, and Postgres refuses the statement outright,
  // which recorded nobody from 2026-09-20 to 2026-09-24.
  it('casts the member id at every use so its type is the same on any column type', async () => {
    const outcome = await recordLoginEventNow('user_a');
    expect(outcome).toEqual({ recorded: true, wroteNow: true, error: null });
    const sql = executed[0]?.sql ?? '';
    expect(sql.match(/\$1(?!::text)/g)).toBeNull();
    expect(sql.match(/\$1::text/g)?.length).toBe(2);
    expect(executed[0]?.values).toEqual(['user_a']);
  });
});
