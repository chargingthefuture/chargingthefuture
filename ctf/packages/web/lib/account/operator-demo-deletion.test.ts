import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryDb = vi.fn();
vi.mock('lib/db/postgres', () => ({ queryDb: (...args: unknown[]) => queryDb(...args) }));

import { operatorClearedDemoAccount } from './operator-demo-deletion';

function answer(demoSchema: boolean, operatorRow: boolean) {
  queryDb.mockImplementation(async (raw: unknown) => {
    const sql = String(raw);
    if (sql.includes("to_regclass('demo.account_deletion_events')")) return { rows: [{ found: demoSchema }] };
    if (sql.includes('FROM demo.account_deletion_events')) return { rows: operatorRow ? [{ one: 1 }] : [] };
    return { rows: [] };
  });
}

describe('operator demo deletion check for the Clerk webhook (issue #2893)', () => {
  beforeEach(() => queryDb.mockReset());

  it('is true when an operator recently cleared the account from the demo schema', async () => {
    answer(true, true);
    expect(await operatorClearedDemoAccount('user_demo')).toBe(true);
    const read = queryDb.mock.calls.find(([sql]) => String(sql).includes('FROM demo.account_deletion_events'));
    expect(String(read?.[0])).toContain("summary->>'initiatedBy' = 'operator'");
    expect(read?.[1]).toEqual(['user_demo', 72]);
  });

  it('is false when there is no such deletion', async () => {
    answer(true, false);
    expect(await operatorClearedDemoAccount('user_demo')).toBe(false);
  });

  it('is false, without reading the table, when there is no demo schema', async () => {
    answer(false, false);
    expect(await operatorClearedDemoAccount('user_demo')).toBe(false);
    expect(queryDb.mock.calls.some(([sql]) => String(sql).includes('FROM demo.account_deletion_events'))).toBe(false);
  });
});
