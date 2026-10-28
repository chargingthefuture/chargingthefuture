import { describe, expect, it, vi } from 'vitest';

vi.mock('lib/db/postgres', () => ({ queryDb: vi.fn() }));
vi.mock('lib/shared/unlock-interface', () => ({
  listUnlockedUserIds: vi.fn(async (ids: string[]) => new Set(ids.filter((id) => id !== 'not-approved'))),
}));

import { computeTrustedReceivers } from './member-value-counts';

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe('computeTrustedReceivers', () => {
  it('keeps approved members past their first 14 days', async () => {
    const firstLogins = new Map([
      ['settled', daysAgo(30)],
      ['new', daysAgo(3)],
      ['not-approved', daysAgo(60)],
      ['unreadable', 'not a date'],
    ]);
    expect(await computeTrustedReceivers(firstLogins)).toEqual(['settled']);
  });

  it('asks nothing when nobody is settled', async () => {
    expect(await computeTrustedReceivers(new Map([['new', daysAgo(1)]]))).toEqual([]);
  });
});
