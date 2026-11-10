import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeTodayCard } from '@ctf/shared';

const { notifySafe } = vi.hoisted(() => ({ notifySafe: vi.fn(async (_input: unknown) => undefined) }));
vi.mock('lib/notifications/repository', () => ({ notifySafe }));
vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));
vi.mock('./windows', () => ({ readWindows: vi.fn(async () => new Map()) }));

import { applyLifetimes } from './apply-lifetimes';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const DAY = 86_400_000;

function ask(id: string, daysAgo: number, authorId: string | null): SeTodayCard {
  return {
    id,
    kind: 'ask',
    source: id.split(':')[0],
    label: 'Ask',
    title: 'Groceries',
    body: null,
    author: authorId ? { accountId: authorId, handle: authorId } : null,
    createdAtIso: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    href: '/apps/socket-relay',
    actions: [],
  };
}

describe('applyLifetimes', () => {
  beforeEach(() => notifySafe.mockClear());

  it("keeps one copy of the viewer's own ask, marked as theirs, and leaves out an ask past 14 days", async () => {
    const own = ask('socket-relay:1', 2, 'me');
    const cards = await applyLifetimes([own, { ...own }, ask('socket-relay:2', 15, 'other')], { userId: 'me', isAdmin: false }, new Set(['socket-relay:1']), NOW);
    expect(cards.map((c) => c.id)).toEqual(['socket-relay:1']);
    expect(cards[0].mine?.canRenew).toBe(true);
    expect(notifySafe).not.toHaveBeenCalled();
  });

  it('sends the day-14 notice to the poster, keyed by the end of the window', async () => {
    await applyLifetimes([ask('socket-relay:1', 13.5, 'me'), ask('socket-relay:2', 13.5, 'other')], { userId: 'me', isAdmin: false }, new Set(['socket-relay:1']), NOW);
    expect(notifySafe).toHaveBeenCalledTimes(1);
    expect(notifySafe).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'me', notificationType: 'today.renew', linkPath: '/apps/socket-relay?renew=socket-relay%3A1' }),
    );
  });
});
