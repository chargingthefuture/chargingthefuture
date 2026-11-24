import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));
vi.mock('lib/demo-mode/demo-accounts', () => ({ runsOnDemoData: vi.fn(async (userId: string) => userId === 'demo-1') }));
vi.mock('lib/mutes/repository', () => ({ listMutes: vi.fn(async () => []) }));
vi.mock('lib/measures/action-minutes', () => ({ readDaysWon: vi.fn(async () => ({ total: 12.5, thisWeek: 1 })) }));
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
  hoursOffers: vi.fn(async () => {
    throw new Error('foundation down');
  }),
}));
vi.mock('./sources-cohort', () => ({ cohortCard: vi.fn(async () => []) }));
vi.mock('./sources-stories', () => ({
  announcementStories: vi.fn(async () => []),
  inviteStories: vi.fn(async () => []),
  whatWorksStory: vi.fn(async () => []),
  surveyCard: vi.fn(async () => []),
}));
vi.mock('./sources-live', () => ({
  moodCard: vi.fn(async () => []),
  numbersCard: vi.fn(async () => []),
  wantedCard: vi.fn(async () => []),
  missionCard: vi.fn(async () => []),
  broadcast: vi.fn(async () => null),
}));
vi.mock('./sources-replays', () => ({ replayCards: vi.fn(async () => []) }));
vi.mock('./sources-mine', () => ({ mineCards: vi.fn(async () => []) }));
vi.mock('./marks/repository', () => ({ readCardMarks: vi.fn(async () => []) }));
vi.mock('lib/fireside/story-comments', () => ({ listStoryCommentTimes: vi.fn(async () => new Map()) }));
vi.mock('./windows', () => ({ readWindows: vi.fn(async () => new Map()) }));
vi.mock('lib/notifications/repository', () => ({ notifySafe: vi.fn(async () => undefined) }));
vi.mock('./sources-questions', () => ({ questionCards: vi.fn(async () => []) }));
vi.mock('./sources-commons', () => ({ commonsCards: vi.fn(async () => []) }));
vi.mock('./sources-blog', () => ({ blogStories: vi.fn(async () => []), storiesTomorrow: vi.fn(async () => 5) }));
vi.mock('./presence', () => ({ readPresence: vi.fn(async () => 3) }));
vi.mock('./saves/repository', () => ({ readSavedIds: vi.fn(async () => new Set()) }));
vi.mock('./apply-joined', () => ({ applyMemberJoined: vi.fn(async (_viewer: unknown, cards: unknown) => cards) }));
vi.mock('./daily-credit/choose', async () => ({
  ...(await vi.importActual<typeof import('./daily-credit/choose')>('./daily-credit/choose')),
  dailyCreditCardId: vi.fn(async () => null),
}));
vi.mock('./sources-daily', () => ({ dailyPuzzleCard: vi.fn(async () => []) }));
vi.mock('./sources-rooms', () => ({
  nextTalk: vi.fn(async () => null),
  weekTalks: vi.fn(async () => []),
  mainRoom: vi.fn(async () => ({ key: 'main', name: 'Main Room', live: false, members: 0, guests: 0, speakers: 0, faces: [], href: '/apps/chyme', nextTalk: null })),
  weaversRoom: vi.fn(async () => null),
}));

function stub(id: string, createdAtIso: string) {
  return { id, kind: 'ask', source: id.split(':')[0], label: 'Ask', title: id, body: null, author: null, createdAtIso, href: '/', actions: [] };
}

import { buildToday, orderTodayCards, TODAY_MAX_CARDS } from './build';

const NOW = new Date('2026-11-03T12:00:00.000Z');

describe('buildToday', () => {
  beforeEach(() => vi.clearAllMocks());

  it('puts the newest card first', async () => {
    const today = await buildToday({ userId: 'u1', isAdmin: false }, NOW);
    expect(today.cards.map((c) => c.id)).toEqual(['lighthouse:1', 'peer-programming:1']);
  });

  it('leaves out each failing source and names it, keeping the rest', async () => {
    const today = await buildToday({ userId: 'u1', isAdmin: false }, NOW);
    expect(today.unavailable).toEqual(['socket-relay', 'foundation']);
    expect(today.rooms).toHaveLength(1);
  });

  it('marks Days won as sample for an account on demo data only, so its screen ticks it', async () => {
    const real = await buildToday({ userId: 'u1', isAdmin: false }, NOW);
    const demo = await buildToday({ userId: 'demo-1', isAdmin: false }, NOW);
    expect(real.daysWon).toEqual({ total: 12.5, thisWeek: 1 });
    expect(demo.daysWon).toEqual({ total: 12.5, thisWeek: 1, sample: true });
  });

  it('carries how many members are here and how many stories open tomorrow', async () => {
    const today = await buildToday({ userId: 'u1', isAdmin: false }, NOW);
    expect(today.presence).toBe(3);
    expect(today.storiesTomorrow).toBe(5);
  });
});

describe('orderTodayCards', () => {
  const at = (day: number) => new Date(Date.UTC(2026, 10, day)).toISOString();
  const story = (n: number) => ({ ...stub(`blog-story:${n}`, at(20)), kind: 'story' as const });

  it('keeps an older ask that a full day of stories would push off, newest first', () => {
    const stories = Array.from({ length: TODAY_MAX_CARDS + 5 }, (_, n) => story(n));
    const ask = stub('socket-relay:old', at(1));
    const offer = { ...stub('lighthouse:old', at(2)), kind: 'offer' as const };
    const ordered = orderTodayCards([ask, ...stories, offer] as Parameters<typeof orderTodayCards>[0]);
    expect(ordered).toHaveLength(TODAY_MAX_CARDS);
    expect(ordered.slice(-2).map((c) => c.id)).toEqual(['lighthouse:old', 'socket-relay:old']);
    expect(ordered.filter((c) => c.kind === 'story')).toHaveLength(TODAY_MAX_CARDS - 2);
  });
});
