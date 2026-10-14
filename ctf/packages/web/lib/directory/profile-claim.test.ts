import { beforeEach, describe, expect, it, vi } from 'vitest';

// One claimed listing per account. The admin assign refuses an account that already owns one, and
// takes the per-account lock first so a member's own first save cannot land between the check and the
// claim. The removal used by Directory and account deletion takes every listing the account owns.
const executed: { sql: string; values: readonly unknown[] }[] = [];
let profileRow: { id: string; claimed_by_user_id: string | null } | null = null;
let ownedRows: { id: string; profile_url: string | null }[] = [];

const client = {
  query: vi.fn(async (sql: string, values: readonly unknown[] = []) => {
    executed.push({ sql, values });
    if (sql.includes('SELECT id, claimed_by_user_id FROM directory_profiles WHERE id::text')) {
      return { rows: profileRow ? [profileRow] : [] };
    }
    if (sql.includes('SELECT id::text AS id FROM directory_profiles WHERE claimed_by_user_id')) {
      return { rows: ownedRows.slice(0, 1).map((row) => ({ id: row.id })) };
    }
    if (sql.includes('SELECT id, profile_url FROM directory_profiles p WHERE claimed_by_user_id')) {
      return { rows: ownedRows };
    }
    return { rows: [] };
  }),
};

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async () => ({ rows: [] })),
  withDbTransaction: vi.fn(async (fn: (c: typeof client) => Promise<unknown>) => fn(client)),
}));

const { assignAdminProfile, removeClaimedDirectoryProfile } = await import('./repository');

describe('assignAdminProfile', () => {
  beforeEach(() => {
    executed.length = 0;
    profileRow = { id: 'profile-nominated', claimed_by_user_id: null };
    ownedRows = [];
  });

  it('refuses an account that already owns a listing and claims nothing', async () => {
    ownedRows = [{ id: 'profile-own', profile_url: null }];
    await expect(assignAdminProfile('admin_1', 'profile-nominated', 'user_1')).resolves.toBe('account_has_profile');
    expect(executed.some((q) => q.sql.includes('SET claimed_by_user_id'))).toBe(false);
    const deny = executed.find((q) => q.sql.includes("'account_already_owns_profile'"));
    expect(deny?.values).toEqual(['admin_1', 'profile-nominated', 'user_1', 'profile-own']);
  });

  it('takes the per-account lock before reading anything', async () => {
    ownedRows = [{ id: 'profile-own', profile_url: null }];
    await assignAdminProfile('admin_1', 'profile-nominated', 'user_1');
    expect(executed[0].sql).toContain('pg_advisory_xact_lock');
    expect(executed[0].values).toEqual(['user_1']);
  });

  it('still refuses a listing another member already claimed', async () => {
    profileRow = { id: 'profile-nominated', claimed_by_user_id: 'user_2' };
    await expect(assignAdminProfile('admin_1', 'profile-nominated', 'user_1')).resolves.toBe('already_claimed');
  });
});

describe('removeClaimedDirectoryProfile', () => {
  beforeEach(() => {
    executed.length = 0;
    ownedRows = [];
  });

  it('removes every listing the account owns', async () => {
    ownedRows = [
      { id: 'profile-a', profile_url: null },
      { id: 'profile-b', profile_url: null },
    ];
    await expect(removeClaimedDirectoryProfile(client as never, 'user_1', 'reason')).resolves.toEqual(['profile-a', 'profile-b']);
    const deletes = executed.filter((q) => q.sql.startsWith('DELETE FROM directory_profiles WHERE id::text'));
    expect(deletes.map((q) => q.values[0])).toEqual(['profile-a', 'profile-b']);
  });

  it('removes nothing for an account with no listing', async () => {
    await expect(removeClaimedDirectoryProfile(client as never, 'user_1', 'reason')).resolves.toEqual([]);
  });
});
