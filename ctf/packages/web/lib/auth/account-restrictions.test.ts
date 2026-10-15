import { beforeEach, describe, expect, it, vi } from 'vitest';

// The admin restriction routes and the writers behind them. Three things went wrong here: a
// restriction was accepted for any id at all, lifting a restriction reported success and wrote an
// audit row when nothing was restricted, and the change and its audit row were two separate writes,
// so a failed audit insert left a saved restriction reported as a failure with no record of it.
//
// The database is a fixture: `withDbTransaction` keeps a transaction's writes aside and applies them
// only when the callback returns, the way BEGIN / COMMIT / ROLLBACK do.

type Restriction = { isRestricted: boolean };
const restrictions = new Map<string, Restriction>();
const audit: { action: string; target: string }[] = [];
let failAuditInsert = false;
let lookup: 'found' | 'not_found' | 'unverifiable' = 'found';

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  withDbTransaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => {
    const pendingRestrictions = new Map<string, Restriction>();
    const pendingAudit: { action: string; target: string }[] = [];
    const client = {
      query: async (sql: string, values: unknown[]) => {
        if (sql.includes('INSERT INTO account_restrictions_audit')) {
          if (failAuditInsert) throw new Error('audit table unavailable');
          pendingAudit.push({ action: String(values[1]), target: String(values[2]) });
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO account_restrictions')) {
          pendingRestrictions.set(String(values[0]), { isRestricted: true });
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes('UPDATE account_restrictions')) {
          const id = String(values[0]);
          const current = restrictions.get(id);
          const requiresRestricted = sql.includes('is_restricted = TRUE');
          if (!current || (requiresRestricted && !current.isRestricted)) return { rows: [], rowCount: 0 };
          pendingRestrictions.set(id, { isRestricted: false });
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`unexpected statement: ${sql}`);
      },
    };
    const result = await callback(client);
    for (const [id, row] of pendingRestrictions) restrictions.set(id, row);
    audit.push(...pendingAudit);
    return result;
  }),
}));

vi.mock('lib/auth/server-authz', () => ({
  evaluatePluginAccess: vi.fn(async () => ({ allowed: true, userId: 'admin-1' })),
}));

vi.mock('lib/auth/csrf', () => ({ checkMutationOrigin: vi.fn(() => 'allow') }));

vi.mock('lib/auth/account-lookup', () => ({ lookUpAccount: vi.fn(async () => lookup) }));

vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));

const { restrictAccount, unrestrictAccount } = await import('lib/auth/account-restrictions');
const restrictRoute = await import('@/app/api/admin/account-restrictions/restrict/route');
const unrestrictRoute = await import('@/app/api/admin/account-restrictions/unrestrict/route');

function post(body: unknown): Request {
  return new Request('https://example.test/api/admin/account-restrictions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  restrictions.clear();
  audit.length = 0;
  failAuditInsert = false;
  lookup = 'found';
});

describe('restricting an account', () => {
  it('refuses an id no account has, and writes nothing', async () => {
    lookup = 'not_found';
    const res = await restrictRoute.POST(post({ targetUserId: 'user_typo' }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('target_not_found');
    expect(restrictions.size).toBe(0);
    expect(audit).toEqual([]);
  });

  it('trims a pasted id before it is checked and stored', async () => {
    const res = await restrictRoute.POST(post({ targetUserId: '  user_real ' }));
    expect(res.status).toBe(200);
    expect(restrictions.get('user_real')?.isRestricted).toBe(true);
    expect(audit).toEqual([{ action: 'restrict', target: 'user_real' }]);
  });

  it('refuses an id that is not a string, or only spaces', async () => {
    expect((await restrictRoute.POST(post({ targetUserId: 42 }))).status).toBe(400);
    expect((await restrictRoute.POST(post({ targetUserId: '   ' }))).status).toBe(400);
  });

  it('still restricts when the sign-in provider cannot be asked, and says the id was not checked', async () => {
    lookup = 'unverifiable';
    const res = await restrictRoute.POST(post({ targetUserId: 'user_real' }));
    expect(res.status).toBe(200);
    expect((await res.json()).targetChecked).toBe(false);
  });

  it('saves neither the restriction nor its audit row when the audit insert fails', async () => {
    failAuditInsert = true;
    await expect(restrictAccount({ targetUserId: 'user_real', actorId: 'admin-1' })).rejects.toThrow('audit table unavailable');
    expect(restrictions.has('user_real')).toBe(false);
    expect(audit).toEqual([]);
  });
});

describe('lifting a restriction', () => {
  it('lifts one in force and records it', async () => {
    restrictions.set('user_real', { isRestricted: true });
    const res = await unrestrictRoute.POST(post({ targetUserId: 'user_real' }));
    expect(res.status).toBe(200);
    expect(restrictions.get('user_real')?.isRestricted).toBe(false);
    expect(audit).toEqual([{ action: 'unrestrict', target: 'user_real' }]);
  });

  it('says there was nothing to lift, and writes no audit row, for an account not restricted', async () => {
    restrictions.set('user_lifted', { isRestricted: false });
    for (const id of ['user_lifted', 'user_never', 'user_typo']) {
      const res = await unrestrictRoute.POST(post({ targetUserId: id }));
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe('not_restricted');
    }
    expect(audit).toEqual([]);
  });

  it('reports no change to the other callers either', async () => {
    const outcome = await unrestrictAccount({ targetUserId: 'user_never', actorId: 'admin-1' });
    expect(outcome).toEqual({ targetUserId: 'user_never', restricted: false, changed: false });
  });

  it('keeps the restriction in force when the audit insert fails', async () => {
    restrictions.set('user_real', { isRestricted: true });
    failAuditInsert = true;
    await expect(unrestrictAccount({ targetUserId: 'user_real', actorId: 'admin-1' })).rejects.toThrow('audit table unavailable');
    expect(restrictions.get('user_real')?.isRestricted).toBe(true);
  });
});
