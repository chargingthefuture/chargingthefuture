import { beforeEach, describe, expect, it, vi } from 'vitest';

const identity = vi.hoisted(() => ({ userId: 'user_demo' as string | null }));
const db = vi.hoisted(() => ({
  rows: [{ user_id: 'user_demo' }] as { user_id: string }[],
  fail: null as Error | null,
  forced: [] as string[],
  texts: [] as string[],
}));

vi.mock('lib/auth/request-identity', () => ({ getRequestUserId: vi.fn(async () => identity.userId) }));
vi.mock('lib/db/postgres', () => ({
  runWithForcedPool: vi.fn(async (target: string, fn: () => Promise<unknown>) => {
    db.forced.push(target);
    return fn();
  }),
  queryDb: vi.fn(async (text: string) => {
    db.texts.push(text);
    if (db.fail) throw db.fail;
    return { rows: text.startsWith('SELECT') ? db.rows : [] };
  }),
}));

import {
  DEMO_ACCOUNTS_CACHE_MS,
  isDemoAccount,
  isDemoMode,
  resetDemoAccountsCacheForTests,
  setDemoAccount,
} from './demo-accounts';

const reads = () => db.texts.filter((text) => text.startsWith('SELECT')).length;

beforeEach(() => {
  resetDemoAccountsCacheForTests();
  identity.userId = 'user_demo';
  db.rows = [{ user_id: 'user_demo' }];
  db.fail = null;
  db.forced = [];
  db.texts = [];
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('isDemoMode', () => {
  it('is on for an account on the demo list, read from the public schema', async () => {
    expect(await isDemoMode()).toBe(true);
    expect(db.forced).toEqual(['public']);
    expect(db.texts[0]).toContain('public.demo_mode_accounts');
  });

  it('is off for an account not on the list', async () => {
    identity.userId = 'user_member';
    expect(await isDemoMode()).toBe(false);
  });

  it('is off with nobody signed in, without reading the list', async () => {
    identity.userId = null;
    expect(await isDemoMode()).toBe(false);
    expect(reads()).toBe(0);
  });

  it('is off and says why when the list cannot be read and none was read before', async () => {
    db.fail = new Error('connection refused');
    expect(await isDemoMode()).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('connection refused'));
    expect(String(vi.mocked(console.error).mock.calls[0][0])).not.toContain('user_demo');
  });
});

describe('isDemoAccount', () => {
  it('reads the list once a minute', async () => {
    await isDemoAccount('user_demo', 1_000);
    await isDemoAccount('user_demo', 1_000 + DEMO_ACCOUNTS_CACHE_MS - 1);
    expect(reads()).toBe(1);
    await isDemoAccount('user_demo', 1_000 + DEMO_ACCOUNTS_CACHE_MS);
    expect(reads()).toBe(2);
  });

  it('keeps the last list read when a later read fails', async () => {
    expect(await isDemoAccount('user_demo', 1_000)).toBe(true);
    db.fail = new Error('timeout');
    expect(await isDemoAccount('user_demo', 1_000 + DEMO_ACCOUNTS_CACHE_MS)).toBe(true);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('last list read is kept'));
  });
});

describe('setDemoAccount', () => {
  it('writes the public table and makes this server read the list again', async () => {
    await isDemoAccount('user_member', 1_000);
    db.rows = [{ user_id: 'user_demo' }, { user_id: 'user_member' }];
    await setDemoAccount({ userId: 'user_member', on: true, actorUserId: 'admin_1' });
    expect(db.texts.some((text) => text.includes('INSERT INTO public.demo_mode_accounts'))).toBe(true);
    expect(await isDemoAccount('user_member', 2_000)).toBe(true);
    await setDemoAccount({ userId: 'user_member', on: false, actorUserId: 'admin_1' });
    expect(db.texts.some((text) => text.includes('DELETE FROM public.demo_mode_accounts'))).toBe(true);
    expect(db.forced.every((target) => target === 'public')).toBe(true);
  });
});
