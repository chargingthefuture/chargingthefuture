import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));
vi.mock('./sources-asks', () => ({
  goalAsks: vi.fn(async () => [stub('peer-programming:1', '2026-10-26T10:00:00.000Z')]),
  relayAsks: vi.fn(async () => {
    throw new Error('relay down');
  }),
  rideAsks: vi.fn(async () => []),
}));
vi.mock('./sources-offers', () => ({
  placeOffers: vi.fn(async () => [stub('lighthouse:1', '2026-10-26T12:00:00.000Z')]),
  cohortOffers: vi.fn(async () => []),
}));
vi.mock('./sources-stories', () => ({
  announcementStories: vi.fn(async () => []),
  inviteStories: vi.fn(async () => []),
  whatWorksStory: vi.fn(async () => []),
}));
vi.mock('./sources-live', () => ({
  moodCard: vi.fn(async () => []),
  numbersCard: vi.fn(async () => []),
  replayCards: vi.fn(async () => []),
  wantedCard: vi.fn(async () => []),
  broadcast: vi.fn(async () => null),
}));
vi.mock('./sources-rooms', () => ({
  nextTalk: vi.fn(async () => null),
  mainRoom: vi.fn(async () => ({ key: 'main', name: 'Main Room', live: false, members: 0, guests: 0, href: '/apps/chyme', nextTalk: null })),
  weaversRoom: vi.fn(async () => null),
}));

function stub(id: string, createdAtIso: string) {
  return { id, kind: 'ask', source: id.split(':')[0], label: 'Ask', title: id, body: null, author: null, createdAtIso, href: '/', actions: [] };
}

import { buildToday } from './build';

describe('buildToday', () => {
  beforeEach(() => vi.clearAllMocks());

  it('puts the newest card first', async () => {
    const today = await buildToday({ userId: 'u1', isAdmin: false });
    expect(today.cards.map((c) => c.id)).toEqual(['lighthouse:1', 'peer-programming:1']);
  });

  it('leaves out a failing source and names it, keeping the rest', async () => {
    const today = await buildToday({ userId: 'u1', isAdmin: false });
    expect(today.unavailable).toEqual(['socket-relay']);
    expect(today.rooms).toHaveLength(1);
  });
});
