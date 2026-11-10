import type { SeToday, SeTodayBroadcast, SeTodayCard, SeTodayRoom } from '@ctf/shared';
import { reportError } from 'lib/observability/report';
import type { TodayViewer } from './card';
import { goalAsks, relayAsks, rideAsks } from './sources-asks';
import { cohortOffers, placeOffers } from './sources-offers';
import { blogStories } from './sources-blog';
import { dailyPuzzleCard } from './sources-daily';
import { announcementStories, inviteStories, surveyCard, whatWorksStory } from './sources-stories';
import { broadcast, missionCard, moodCard, numbersCard, wantedCard } from './sources-live';
import { replayCards } from './sources-replays';
import { mainRoom, nextTalk, weekTalks, weaversRoom } from './sources-rooms';
import { questionCards } from './sources-questions';
import { readDaysWon } from 'lib/measures/action-minutes';
import { listMutes } from 'lib/mutes/repository';
import { seApplyMutes } from '@ctf/shared';
import { mineCards } from './sources-mine';
import { applyLifetimes } from './apply-lifetimes';

// The Today read. Every source runs at once and on its own: one that fails leaves its cards out,
// is reported, and is named in `unavailable` so the screen can say what is missing instead of
// looking empty. Cards are newest first, with the day's own cards (Mood, numbers, What Works)
// sorted among them by the start of the day. How long each card stays is applyLifetimes
// (lifetime.ts): asks until met, closed or due, asks and offers 14 days with a renew, the rest 7.

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
    { name: 'questions', read: () => questionCards(viewer, now) },
    { name: 'announcements', read: () => announcementStories(viewer) },
    { name: 'directory-invites', read: () => inviteStories() },
    { name: 'what-works', read: () => whatWorksStory(viewer, now) },
    { name: 'blog-stories', read: () => blogStories(now) },
    { name: 'games', read: () => dailyPuzzleCard(now) },
    { name: 'quora-survey', read: () => surveyCard(viewer, now) },
    { name: 'mood', read: () => moodCard(viewer, now) },
    { name: 'numbers', read: () => numbersCard(now) },
    { name: 'beacon-replays', read: () => replayCards(now) },
    { name: 'skills-hunt', read: () => wantedCard() },
    { name: 'skills-hunt-mission', read: () => missionCard(now) },
    { name: 'yours', read: () => mineCards(viewer) },
  ];

  const week = weekTalks(now);
  const [cardLists, live, room, weekList, weavers, daysWon, mutes] = await Promise.all([
    Promise.all(sources.map((source) => settle(source.name, source.read, unavailable))),
    settle<SeTodayBroadcast | null>('beacon', () => broadcast(), unavailable),
    settle<SeTodayRoom>('chyme', () => mainRoom(nextTalk(week), true), unavailable),
    // A schedule that fails to read leaves the strip empty rather than the room missing.
    settle('ti-radio', () => week, []),
    // Reported but never named on screen: a member who may not enter is not told the room exists.
    settle<SeTodayRoom | null>('weavers', () => weaversRoom(viewer), []),
    settle('days-won', () => readDaysWon(now), unavailable),
    // A member's own mutes; a failed read shows every card rather than none.
    settle('mutes', () => listMutes(viewer.userId), []),
  ]);

  const mineIds = new Set((cardLists[sources.length - 1] ?? []).map((card) => card.id));
  const lasting = await applyLifetimes(cardLists.flatMap((list) => list ?? []), viewer, mineIds, now);
  const cards = seApplyMutes(lasting, mutes ?? [])
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
    .slice(0, TODAY_MAX_CARDS);

  return {
    generatedAtIso: now.toISOString(),
    presence: null,
    daysWon: daysWon ?? null,
    broadcast: live ?? null,
    rooms: [room, weavers].filter((item): item is SeTodayRoom => Boolean(item)),
    week: weekList ?? [],
    cards,
    unavailable,
  };
}
