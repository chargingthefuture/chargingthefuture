import type { SeToday, SeTodayBroadcast, SeTodayCard, SeTodayRoom } from '@ctf/shared';
import { blogStories } from './sources-blog';
import { dailyPuzzleCard } from './sources-daily';
import { reportError } from 'lib/observability/report';
import { cohortOffers } from './sources-offers';
import { broadcast, missionCard, numbersCard, wantedCard } from './sources-live';
import { replayCards } from './sources-replays';
import { mainRoom, nextTalk, weekTalks } from './sources-rooms';
import { readDaysWon } from 'lib/measures/action-minutes';
import { listAvailableRequests as listRideRequests } from 'lib/trust-transport/repository';
import { action, card } from './card';
import { TODAY_MAX_CARDS } from './build';
import { runWithForcedPool } from 'lib/db/postgres';

// Today for a visitor who is not signed in (3.1.0 plan, Access: read Today, names on asks hidden).
// Only what is already public or carries no person: the live broadcast, the Main Room (guests can
// listen), the day's numbers, recorded broadcasts, SkillsHunt's wanted card and mission, Skill Up
// cohorts, and that rides are wanted. Nothing personal and no name: asks that carry a name or text
// a member wrote (goals, SocketRelay, LightHouse), announcements, invitations, Mood, the survey and
// the Weavers room are left out.
//
// Sample data (owner decision, 2026-11-10): what is built from individual members' rows — Days won
// (its total and this week), ride asks and Skill Up cohorts — is read from the demo schema instead,
// the separate copy of every table the demo accounts use, and marked `sample` so the screen tags it.
// A signed-out visitor never reaches those members' rows, and the demo rows never reach a real
// count, because every count reads the public schema. Stories, the puzzle, the rooms, the day's
// numbers, replays and SkillsHunt stay real.

// Reads from the demo schema, whoever is asking; signed-out Today has nobody to target.
export function readSample<T>(read: () => Promise<T>): Promise<T> {
  return runWithForcedPool('demo', read);
}

async function sampleCards(read: () => Promise<SeTodayCard[]>): Promise<SeTodayCard[]> {
  return (await readSample(read)).map((item) => ({ ...item, sample: true }));
}

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
    { name: 'trust-transport', read: () => sampleCards(publicRideAsks) },
    { name: 'skill-up', read: () => sampleCards(() => cohortOffers()) },
    { name: 'numbers', read: () => numbersCard(now) },
    { name: 'blog-stories', read: () => blogStories(now) },
    // Signed out, the puzzle can be read but not played, so its button says so.
    { name: 'games', read: async () => (await dailyPuzzleCard(now)).map((item) => ({ ...item, actions: [action('open', 'See the puzzle', item.href)] })) },
    { name: 'beacon-replays', read: () => replayCards(now) },
    { name: 'skills-hunt', read: () => wantedCard() },
    { name: 'skills-hunt-mission', read: () => missionCard(now) },
  ];
  const week = weekTalks(now);
  const [cardLists, live, room, weekList, daysWon] = await Promise.all([
    Promise.all(sources.map((source) => settle(source.name, source.read, unavailable))),
    settle<SeTodayBroadcast | null>('beacon', () => broadcast(), unavailable),
    settle<SeTodayRoom>('chyme', () => mainRoom(nextTalk(week), false), unavailable),
    // A schedule that fails to read leaves the strip empty rather than the room missing.
    settle('ti-radio', () => week, []),
    settle('days-won', async () => ({ ...(await readSample(() => readDaysWon(now))), sample: true }), unavailable),
  ]);
  const cards = cardLists
    .flatMap((list) => list ?? [])
    // No author, and no comment times: those are only for a member's own marks.
    .map((item) => ({ ...item, author: null, commentTimesIso: undefined }))
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
    .slice(0, TODAY_MAX_CARDS);
  return {
    generatedAtIso: now.toISOString(),
    presence: null,
    daysWon: daysWon ?? null,
    broadcast: live ?? null,
    rooms: room ? [room] : [],
    week: weekList ?? [],
    cards,
    unavailable,
  };
}
