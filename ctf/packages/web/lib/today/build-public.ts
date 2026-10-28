import type { SeToday, SeTodayBroadcast, SeTodayCard, SeTodayRoom } from '@ctf/shared';
import { reportError } from 'lib/observability/report';
import { cohortOffers } from './sources-offers';
import { broadcast, missionCard, numbersCard, replayCards, wantedCard } from './sources-live';
import { mainRoom, nextTalk } from './sources-rooms';
import { readDaysWon } from 'lib/measures/action-minutes';
import { listAvailableRequests as listRideRequests } from 'lib/trust-transport/repository';
import { action, card } from './card';
import { TODAY_MAX_CARDS } from './build';

// Today for a visitor who is not signed in (3.1.0 plan, Access: read Today, names on asks hidden).
// Only what is already public or carries no person: the live broadcast, the Main Room (guests can
// listen), the day's numbers, recorded broadcasts, SkillsHunt's wanted card and mission, Skill Up
// cohorts, and that rides are wanted. Nothing personal and no name: asks that carry a name or text
// a member wrote (goals, SocketRelay, LightHouse), announcements, invitations, Mood, the survey and
// the Weavers room are left out.

type Source = { name: string; read: () => Promise<SeTodayCard[]> };

async function settle<T>(name: string, read: () => Promise<T>, unavailable: string[]): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    reportError(error, { area: 'today', op: `public_source_${name}` });
    unavailable.push(name);
    return null;
  }
}

async function publicRideAsks(): Promise<SeTodayCard[]> {
  const { items } = await listRideRequests({ excludeUserId: '', pageSize: 2 });
  const href = '/apps/trust-transport';
  return items.map((request) =>
    card({
      source: 'trust-transport',
      sourceId: request.id,
      kind: 'ask',
      label: 'Ask · a ride',
      title: 'A ride is wanted',
      body: 'Where and when are shared only with the driver the member accepts.',
      createdAtIso: request.createdAtIso,
      href,
      actions: [action('help', 'I can drive', href)],
    }),
  );
}

export async function buildPublicToday(now = new Date()): Promise<SeToday> {
  const unavailable: string[] = [];
  const sources: Source[] = [
    { name: 'trust-transport', read: publicRideAsks },
    { name: 'skill-up', read: () => cohortOffers() },
    { name: 'numbers', read: () => numbersCard(now) },
    { name: 'beacon-replays', read: () => replayCards() },
    { name: 'skills-hunt', read: () => wantedCard() },
    { name: 'skills-hunt-mission', read: () => missionCard(now) },
  ];
  const [cardLists, live, room, daysWon] = await Promise.all([
    Promise.all(sources.map((source) => settle(source.name, source.read, unavailable))),
    settle<SeTodayBroadcast | null>('beacon', () => broadcast(), unavailable),
    settle<SeTodayRoom>('chyme', () => mainRoom(nextTalk(now)), unavailable),
    settle('days-won', () => readDaysWon(now), unavailable),
  ]);
  const cards = cardLists
    .flatMap((list) => list ?? [])
    .map((item) => ({ ...item, author: null }))
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
    .slice(0, TODAY_MAX_CARDS);
  return {
    generatedAtIso: now.toISOString(),
    presence: null,
    daysWon: daysWon ?? null,
    broadcast: live ?? null,
    rooms: room ? [room] : [],
    cards,
    unavailable,
  };
}
