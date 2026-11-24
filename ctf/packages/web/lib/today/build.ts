import type { SeToday, SeTodayBroadcast, SeTodayCard, SeTodayRoom } from '@ctf/shared';
import { reportError } from 'lib/observability/report';
import type { TodayViewer } from './card';
import { goalAsks, relayAsks, rideAsks } from './sources-asks';
import { cohortOffers, hoursOffers, placeOffers } from './sources-offers';
import { cohortCard } from './sources-cohort';
import { blogStories, storiesTomorrow } from './sources-blog';
import { dailyPuzzleCard } from './sources-daily';
import { announcementStories, inviteStories, surveyCard, whatWorksStory } from './sources-stories';
import { broadcast, missionCard, moodCard, numbersCard, wantedCard } from './sources-live';
import { replayCards } from './sources-replays';
import { mainRoom, nextTalk, weekTalks, weaversRoom } from './sources-rooms';
import { questionCards } from './sources-questions';
import { commonsCards } from './sources-commons';
import { readDaysWon } from 'lib/measures/action-minutes';
import { runsOnDemoData } from 'lib/demo-mode/demo-accounts';
import { listMutes } from 'lib/mutes/repository';
import { seApplyMutes, type SeTodayDay } from '@ctf/shared';
import { mineCards } from './sources-mine';
import { utcTodayDay } from './card';
import { applyLifetimes } from './apply-lifetimes';
import { applyMemberMarks, applyMemberSaves } from './apply-marks';
import { applyMemberJoined } from './apply-joined';
import { readPresence } from './presence';
import { dailyCreditCardId, markDailyCredit } from './daily-credit/choose';

// The Today read. Every source runs at once and on its own: one that fails leaves its cards out,
// is reported, and is named in `unavailable` so the screen can say what is missing instead of
// looking empty. Cards are newest first, with the day's own cards (Mood, numbers, What Works)
// sorted among them by the start of the day. How long each card stays is applyLifetimes
// (lifetime.ts): asks until met, closed or due, asks and offers 14 days with a renew, the rest 7.

export const TODAY_MAX_CARDS = 30;

const isAskOrOffer = (card: SeTodayCard) => card.kind === 'ask' || card.kind === 'offer';

// At most TODAY_MAX_CARDS, newest first, with one exception: the viewer's own asks and offers (marked
// `mine`) are always kept, however old and however many, so Today and Me → Open list every one still
// up. Other asks and offers take the places left before the other cards, so an older one is never
// pushed off by the day's stories; the other cards fill what remains.
export function orderTodayCards(cards: SeTodayCard[]): SeTodayCard[] {
  const newest = [...cards].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  const own = newest.filter((card) => isAskOrOffer(card) && card.mine);
  const asks = newest.filter((card) => isAskOrOffer(card) && !card.mine).slice(0, Math.max(0, TODAY_MAX_CARDS - own.length));
  const left = Math.max(0, TODAY_MAX_CARDS - own.length - asks.length);
  const kept = new Set([...own, ...asks, ...newest.filter((card) => !isAskOrOffer(card)).slice(0, left)]);
  return newest.filter((card) => kept.has(card));
}

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

// Every card source behind Today, in the order they are read; the member's own cards ("yours")
// are last.
export function todaySources(viewer: TodayViewer, day: SeTodayDay, now = new Date()): CardSource[] {
  return [
    { name: 'peer-programming', read: () => goalAsks(viewer) },
    { name: 'socket-relay', read: () => relayAsks(viewer) },
    { name: 'trust-transport', read: () => rideAsks(viewer) },
    { name: 'lighthouse', read: () => placeOffers(viewer) },
    { name: 'foundation', read: () => hoursOffers(viewer) },
    { name: 'peer-programming-cohort', read: () => cohortCard(viewer, now, day) },
    { name: 'skill-up', read: () => cohortOffers() },
    { name: 'questions', read: () => questionCards(viewer, day) },
    { name: 'announcements', read: () => announcementStories(viewer) },
    { name: 'commons', read: () => commonsCards(viewer) },
    { name: 'directory-invites', read: () => inviteStories() },
    { name: 'what-works', read: () => whatWorksStory(viewer, day) },
    { name: 'blog-stories', read: () => blogStories(day) },
    { name: 'games', read: () => dailyPuzzleCard(day) },
    { name: 'quora-survey', read: () => surveyCard(viewer, day) },
    { name: 'mood', read: () => moodCard(viewer, day) },
    { name: 'numbers', read: () => numbersCard(day, true, now) },
    { name: 'beacon-replays', read: () => replayCards(day) },
    { name: 'skills-hunt', read: () => wantedCard() },
    { name: 'skills-hunt-mission', read: () => missionCard(day) },
    { name: 'yours', read: () => mineCards(viewer) },
  ];
}

// An account on demo data reads Days won from the demo schema, where nothing new is counted while a
// recording runs, so the total is marked `sample` and the screen ticks it up now and then with the
// emoji rain, as signed-out Today does. Nothing is written, and a real account's total is untouched.
async function viewerDaysWon(viewer: TodayViewer, now: Date): Promise<SeToday['daysWon']> {
  const daysWon = await readDaysWon(now);
  return (await runsOnDemoData(viewer.userId)) ? { ...daysWon, sample: true } : daysWon;
}

// `day` is the member's own day (seReadTodayDay): stories, the puzzle, 21 Questions and the day's
// own cards follow it, and a card marked done leaves from their next day.
export async function buildToday(viewer: TodayViewer, now = new Date(), day: SeTodayDay = utcTodayDay(now)): Promise<SeToday> {
  const unavailable: string[] = [];
  const sources = todaySources(viewer, day, now);

  const week = weekTalks(now);
  const [cardLists, live, room, weekList, weavers, daysWon, mutes, presence, tomorrow, creditCardId] = await Promise.all([
    Promise.all(sources.map((source) => settle(source.name, source.read, unavailable))),
    settle<SeTodayBroadcast | null>('beacon', () => broadcast(), unavailable),
    settle<SeTodayRoom>('chyme', () => mainRoom(nextTalk(week), true), unavailable),
    // A schedule that fails to read leaves the strip empty rather than the room missing.
    settle('ti-radio', () => week, []),
    // Reported but never named on screen: a member who may not enter is not told the room exists.
    settle<SeTodayRoom | null>('weavers', () => weaversRoom(viewer), []),
    settle('days-won', () => viewerDaysWon(viewer, now), unavailable),
    // A member's own mutes; a failed read shows every card rather than none.
    settle('mutes', () => listMutes(viewer.userId), []),
    // Reported but never named: the pill is simply not shown when the count is unknown.
    settle('presence', () => readPresence(viewer.userId), []),
    settle('stories-tomorrow', () => storiesTomorrow(day), []),
    // Reported but never named: with no answer, no card shows the day's credit.
    settle('daily-credit', () => dailyCreditCardId(now), []),
  ]);

  const mineIds = new Set((cardLists[sources.length - 1] ?? []).map((card) => card.id));
  const lasting = await applyLifetimes(cardLists.flatMap((list) => list ?? []), viewer, mineIds, now);
  const marked = await applyMemberJoined(viewer, await applyMemberSaves(viewer, await applyMemberMarks(viewer, lasting, day.startIso)));
  const cards = orderTodayCards(seApplyMutes(markDailyCredit(marked, creditCardId), mutes ?? []));

  return {
    generatedAtIso: now.toISOString(),
    presence: presence ?? null,
    storiesTomorrow: tomorrow ?? null,
    daysWon: daysWon ?? null,
    broadcast: live ?? null,
    rooms: [room, weavers].filter((item): item is SeTodayRoom => Boolean(item)),
    week: weekList ?? [],
    cards,
    unavailable,
  };
}
