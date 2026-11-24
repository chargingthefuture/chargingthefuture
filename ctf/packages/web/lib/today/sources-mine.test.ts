import { beforeEach, describe, expect, it, vi } from 'vitest';

const listRequests = vi.fn();
vi.mock('lib/socket-relay/repository', () => ({ listRequests: (...args: unknown[]) => listRequests(...args) }));
vi.mock('lib/trust-transport/repository', () => ({ listRequests: vi.fn(async () => ({ items: [] })) }));
vi.mock('lib/lighthouse/repository', () => ({ listMyProperties: vi.fn(async () => []) }));
vi.mock('lib/identity/resolve-usernames', () => ({ resolveUsernames: vi.fn(async () => new Map()) }));
vi.mock('lib/mutual-time/open-events', () => ({ listOpenEvents: vi.fn(async () => []) }));
vi.mock('./sources-offers', () => ({ mutualTimeSurveyCard: vi.fn() }));

import { mineCards } from './sources-mine';

const request = (n: number) => ({
  id: `r${n}`,
  ownerUserId: 'me',
  ownerUsername: 'me',
  title: `Need ${n}`,
  details: 'details',
  createdAtIso: new Date(Date.UTC(2026, 5, 1 + (n % 28))).toISOString(),
});

describe('mineCards: SocketRelay', () => {
  beforeEach(() => {
    listRequests.mockReset();
  });

  it('lists every open request of the viewer, reading page after page', async () => {
    const all = Array.from({ length: 130 }, (_, n) => request(n));
    listRequests.mockImplementation(async ({ page, pageSize }: { page: number; pageSize: number }) => ({
      items: all.slice((page - 1) * pageSize, page * pageSize),
      total: all.length,
    }));
    const cards = await mineCards({ userId: 'me' } as Parameters<typeof mineCards>[0]);
    expect(cards.filter((c) => c.source === 'socket-relay')).toHaveLength(130);
    expect(listRequests).toHaveBeenCalledTimes(2);
    expect(listRequests.mock.calls[0][0]).toMatchObject({ ownerUserId: 'me', statuses: ['open'] });
  });

  it('lists all eleven when a member has eleven open', async () => {
    const all = Array.from({ length: 11 }, (_, n) => request(n));
    listRequests.mockResolvedValue({ items: all, total: 11 });
    const cards = await mineCards({ userId: 'me' } as Parameters<typeof mineCards>[0]);
    expect(cards).toHaveLength(11);
    expect(listRequests).toHaveBeenCalledTimes(1);
  });
});
