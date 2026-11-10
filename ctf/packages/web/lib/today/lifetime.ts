import { SE_TODAY_ASK_DAYS, SE_TODAY_STORY_DAYS, type SeTodayCard, type SeTodayCardMine } from '@ctf/shared';

// How long each kind of card stays on Today (owner decisions, 2026-11-03). Leaving Today never closes
// or deletes anything: every item stays where it lives.
//
// - An ask (a PeerProgramming goal, a SocketRelay request, a ride wanted) stays until it is met or
//   closed (its source stops listing it), or until its deadline passes. With no deadline it stays 14
//   days from posting; the poster can keep it up 14 more days from the tap, as often as they like.
// - An offer (a LightHouse place to stay) stays 14 days the same way, with no deadline.
// - A Skill Up cohort stays exactly while it is open for registration (its source lists only open
//   cohorts with a seat), with no window and no renew: it recruits on its own schedule.
// - The day's own cards (Mood, numbers, stories, the puzzle, What Works, the mission, 21 Questions)
//   are dated to the start of today and keep working as they do. A 21 Questions match card and the
//   Quora survey card stay as they are.
// - Everything else (announcements, Directory invitations, Beacon replays, the Wanted round) stays 7
//   days from posting.

const DAY_MS = 86_400_000;

export const TODAY_ASK_SOURCES = ['peer-programming', 'socket-relay', 'trust-transport'] as const;
export const TODAY_OFFER_SOURCES = ['lighthouse'] as const;

export type TodayCardRule = 'ask' | 'offer' | 'kept' | 'week';

const KEPT_SOURCES: readonly string[] = ['skill-up', 'questions-match', 'quora-survey'];

export function todayCardRule(source: string): TodayCardRule {
  if ((TODAY_ASK_SOURCES as readonly string[]).includes(source)) return 'ask';
  if ((TODAY_OFFER_SOURCES as readonly string[]).includes(source)) return 'offer';
  return KEPT_SOURCES.includes(source) ? 'kept' : 'week';
}

// What the poster set for one card; absent when they set nothing.
export type TodayCardWindow = {
  ownerUserId: string;
  dueIso: string | null;
  shownUntilIso: string | null;
  outcome: 'done' | 'not_done' | null;
};

// When an ask or offer leaves Today: its deadline, else the end of a renewed 14 days, else 14 days
// from posting.
export function windowEndMs(card: Pick<SeTodayCard, 'createdAtIso'>, window: TodayCardWindow | undefined): number {
  if (window?.dueIso) return Date.parse(window.dueIso);
  if (window?.shownUntilIso) return Date.parse(window.shownUntilIso);
  return Date.parse(card.createdAtIso) + SE_TODAY_ASK_DAYS * DAY_MS;
}

export function onToday(card: SeTodayCard, window: TodayCardWindow | undefined, now: Date): boolean {
  const rule = todayCardRule(card.source);
  if (rule === 'kept') return true;
  if (rule === 'week') return now.getTime() < Date.parse(card.createdAtIso) + SE_TODAY_STORY_DAYS * DAY_MS;
  if (window?.outcome) return false;
  return now.getTime() < windowEndMs(card, window);
}

// How long after a window ends its notice can still go out, for a day the daily run missed.
export const RENEW_NOTICE_GRACE_DAYS = 7;

// Day 14: from the last day of a window with no deadline until a week after it ends. The notice is
// sent once per window (the notification is keyed by the window's end), by the daily run
// (renew-notices.ts) or by the poster's own Today read, whichever comes first.
export function renewNoticeDue(card: Pick<SeTodayCard, 'source' | 'createdAtIso'>, window: TodayCardWindow | undefined, now: Date): boolean {
  const rule = todayCardRule(card.source);
  if (rule !== 'ask' && rule !== 'offer') return false;
  if (window?.dueIso || window?.outcome) return false;
  const end = windowEndMs(card, window);
  return now.getTime() >= end - DAY_MS && now.getTime() < end + RENEW_NOTICE_GRACE_DAYS * DAY_MS;
}

export function mineFor(card: SeTodayCard, window: TodayCardWindow | undefined): SeTodayCardMine {
  const isAsk = todayCardRule(card.source) === 'ask';
  return {
    leavesIso: new Date(windowEndMs(card, window)).toISOString(),
    dueIso: window?.dueIso ?? null,
    canClose: isAsk,
    canRenew: !window?.dueIso,
  };
}

// A renew keeps the card up 14 days from the tap.
export function renewedUntil(now: Date): Date {
  return new Date(now.getTime() + SE_TODAY_ASK_DAYS * DAY_MS);
}

// A deadline from + New: a moment from now up to a year ahead. Anything else is no deadline.
export function readDueIso(value: unknown, now: Date): string | null {
  if (typeof value !== 'string') return null;
  const at = Date.parse(value);
  if (Number.isNaN(at) || at <= now.getTime() || at > now.getTime() + 366 * DAY_MS) return null;
  return new Date(at).toISOString();
}
