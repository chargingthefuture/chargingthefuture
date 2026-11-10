import { describe, expect, it, vi } from 'vitest';

// Clerk's user search matches usernames, names and email addresses. The Directory search must find a
// member by username only, so a search never shows whose email or real name matched.
const clerk = vi.hoisted(() => ({
  users: [
    { id: 'user_a', username: 'ada_l' },
    { id: 'user_b', username: 'ben' }, // matched by Clerk on an email containing "ada"
    { id: 'user_c', username: null }, // matched by Clerk on a real name, no username
  ],
}));
vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({ users: { getUserList: async () => ({ data: clerk.users }) } }),
}));
vi.mock('../auth/clerk-env', () => ({ getClerkSecretKey: () => 'sk_test_x' }));

import { findUserIdsByUsername, usernameContains } from './resolve-usernames';

describe('finding a member by username', () => {
  it('keeps only accounts whose username contains the term', async () => {
    expect(await findUserIdsByUsername('ada')).toEqual(['user_a']);
  });

  it('ignores a leading @ and letter case', async () => {
    expect(await findUserIdsByUsername('@ADA')).toEqual(['user_a']);
  });

  it('does not search on fewer than two characters', async () => {
    expect(await findUserIdsByUsername('a')).toEqual([]);
    expect(usernameContains('ada_l', '@a')).toBe(false);
  });

  it('never matches an account with no username', () => {
    expect(usernameContains(null, 'ada')).toBe(false);
  });
});
