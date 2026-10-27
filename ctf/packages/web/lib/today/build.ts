import type { SeToday, SeTodayBroadcast, SeTodayCard, SeTodayRoom } from '@ctf/shared';
import { reportError } from 'lib/observability/report';
import type { TodayViewer } from './card';
import { goalAsks, relayAsks, rideAsks } from './sources-asks';
import { cohortOffers, placeOffers } from './sources-offers';
import { announcementStories, inviteStories, whatWorksStory } from './sources-stories';
import { broadcast, mainRoom, moodCard, numbersCard, replayCards, wantedCard } from './sources-live';

// The Today read. Every source runs at once and on its own: one that fails leaves its cards out,
// is reported, and is named in `unavailable` so the screen can say what is missing instead of
// looking empty. Cards are newest first, with the day's own cards (Mood, numbers, What Works)
// sorted among them by the start of the day.

export const TODAY_MAX_CARDS = 30;

type CardSource = { name: string; read: () => Promise<SeTodayCard[]> };

async function settle<T>(name: string, read: () => Promise<T>, unavailable: string[]): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    reportError(error, { area: 'today', op: `source_${name}` });
    unavailable.push(name);
    return null;
  }
}

export async function buildToday(viewer: TodayViewer, now = new Date()): Promise<SeToday> {
  const unavailable: string[] = [];
  const sources: CardSource[] = [
    { name: 'peer-programming', read: () => goalAsks(viewer) },
    { name: 'socket-relay', read: () => relayAsks(viewer) },
    { name: 'trust-transport', read: () => rideAsks(viewer) },
    { name: 'lighthouse', read: () => placeOffers(viewer) },
    { name: 'skill-up', read: () => cohortOffers() },
    { name: 'announcements', read: () => announcementStories(viewer) },
    { name: 'directory-invites', read: () => inviteStories() },
    { name: 'what-works', read: () => whatWorksStory(viewer, now) },
    { name: 'mood', read: () => moodCard(viewer, now) },
    { name: 'numbers', read: () => numbersCard(now) },
    { name: 'beacon-replays', read: () => replayCards() },
    { name: 'skills-hunt', read: () => wantedCard() },
  ];

  const [cardLists, live, room] = await Promise.all([
    Promise.all(sources.map((source) => settle(source.name, source.read, unavailable))),
    settle<SeTodayBroadcast | null>('beacon', () => broadcast(), unavailable),
    settle<SeTodayRoom>('chyme', () => mainRoom(), unavailable),
  ]);

  const cards = cardLists
    .flatMap((list) => list ?? [])
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
    .slice(0, TODAY_MAX_CARDS);

  return {
    generatedAtIso: now.toISOString(),
    presence: null,
    broadcast: live ?? null,
    rooms: room ? [room] : [],
    cards,
    unavailable,
  };
}
