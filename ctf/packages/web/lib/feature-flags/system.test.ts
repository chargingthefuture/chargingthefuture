import { beforeEach, describe, expect, it, vi } from 'vitest';

const flag = vi.hoisted(() => ({ detail: { value: false, answered: true } }));
const identity = vi.hoisted(() => ({ userId: 'user_demo' as string | null }));
const db = vi.hoisted(() => ({
  rows: [{ user_id: 'user_demo' }] as { user_id: string }[],
  fail: null as Error | null,
  forced: [] as string[],
  reads: 0,
}));

vi.mock('./server', () => ({ evaluateBooleanFlagDetail: vi.fn(async () => flag.detail) }));
vi.mock('lib/auth/request-identity', () => ({ getRequestUserId: vi.fn(async () => identity.userId) }));
vi.mock('lib/db/postgres', () => ({
  runWithForcedPool: vi.fn(async (target: string, fn: () => Promise<unknown>) => {
    db.forced.push(target);
    return fn();
  }),
  queryDb: vi.fn(async () => {
    db.reads += 1;
    if (db.fail) throw db.fail;
    return { rows: db.rows };
  }),
}));

import { isDemoMode } from './system';
import { EXCLUDED_IDS_CACHE_MS, isMarkedDemoAccount, resetDemoFallbackForTests } from './demo-fallback';

beforeEach(() => {
  resetDemoFallbackForTests();
  flag.detail = { value: false, answered: true };
  identity.userId = 'user_demo';
  db.rows = [{ user_id: 'user_demo' }];
  db.fail = null;
  db.forced = [];
  db.reads = 0;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('isDemoMode', () => {
  it('uses the flag as it is when the flag service answered true', async () => {
    flag.detail = { value: true, answered: true };
    identity.userId = 'user_someone';
    expect(await isDemoMode()).toBe(true);
    expect(db.reads).toBe(0);
  });

  it('uses the flag as it is when the flag service answered false, even for a marked account', async () => {
    flag.detail = { value: false, answered: true };
    expect(await isDemoMode()).toBe(false);
    expect(db.reads).toBe(0);
  });

  it('sends a marked demo/test account to demo when the flag service did not answer', async () => {
    flag.detail = { value: false, answered: false };
    expect(await isDemoMode()).toBe(true);
    expect(db.forced).toEqual(['public']);
  });

  it('keeps an account that is not marked on production when the flag service did not answer', async () => {
    flag.detail = { value: false, answered: false };
    identity.userId = 'user_member';
    expect(await isDemoMode()).toBe(false);
  });

  it('uses production outside a request when the flag service did not answer', async () => {
    flag.detail = { value: false, answered: false };
    identity.userId = null;
    expect(await isDemoMode()).toBe(false);
    expect(db.reads).toBe(0);
  });

  it('returns false and says why when the list cannot be read and none was read before', async () => {
    flag.detail = { value: false, answered: false };
    db.fail = new Error('connection refused');
    expect(await isDemoMode()).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('connection refused'));
  });

  it('logs the fallback once per process and never with an account id', async () => {
    flag.detail = { value: false, answered: false };
    await isDemoMode();
    await isDemoMode();
    const fallbackLines = vi.mocked(console.error).mock.calls.filter((call) => String(call[0]).includes('has not answered'));
    expect(fallbackLines).toHaveLength(1);
    expect(String(fallbackLines[0][0])).not.toContain('user_demo');
  });
});

describe('isMarkedDemoAccount', () => {
  it('reads the list once a minute', async () => {
    await isMarkedDemoAccount('user_demo', 1_000);
    await isMarkedDemoAccount('user_demo', 1_000 + EXCLUDED_IDS_CACHE_MS - 1);
    expect(db.reads).toBe(1);
    await isMarkedDemoAccount('user_demo', 1_000 + EXCLUDED_IDS_CACHE_MS);
    expect(db.reads).toBe(2);
  });

  it('keeps the last list read when a later read fails', async () => {
    expect(await isMarkedDemoAccount('user_demo', 1_000)).toBe(true);
    db.fail = new Error('timeout');
    expect(await isMarkedDemoAccount('user_demo', 1_000 + EXCLUDED_IDS_CACHE_MS)).toBe(true);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('last list read is kept'));
  });
});
