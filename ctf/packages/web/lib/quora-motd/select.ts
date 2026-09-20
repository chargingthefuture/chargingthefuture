import {
  QUORA_MOTD_ACTIONS,
  type QuoraMotdAction,
  type QuoraMotdMessage,
} from './types';
import { QUORA_MOTD_FIRESIDE } from './messages-fireside';
import { QUORA_MOTD_TI_RADIO } from './messages-ti-radio';
import { QUORA_MOTD_ONE_PERCENT } from './messages-one-percent';

/**
 * Day one. Peace Battle 2 starts on the evening of Friday 18 September 2026, so the rotation is
 * anchored there rather than at an arbitrary date — the first message of the series is the first
 * day of the protest it asks people to take part in.
 */
export const QUORA_MOTD_EPOCH = '2026-09-18';

/**
 * The owner's clock, not the server's. A message is picked for a calendar day, and the container
 * this runs in is on UTC, which rolls over to the next day at 8pm Eastern. Without this the
 * evening's message would be tomorrow's. Eastern is named rather than a fixed offset so the switch
 * in and out of daylight saving is handled by the platform rather than by arithmetic here.
 */
const MOTD_TIME_ZONE = 'America/New_York';

const POOLS: Record<QuoraMotdAction, QuoraMotdMessage[]> = {
  fireside: QUORA_MOTD_FIRESIDE,
  'ti-radio': QUORA_MOTD_TI_RADIO,
  'one-percent': QUORA_MOTD_ONE_PERCENT,
};

export type QuoraMotdPick = {
  /** The calendar day in Eastern, as YYYY-MM-DD. */
  date: string;
  /** Days since the epoch. Day one of the series is 0. */
  dayIndex: number;
  /** How many complete passes through this action's pool have already happened. */
  cycle: number;
  message: QuoraMotdMessage;
};

/** Today's calendar date where the owner is, as YYYY-MM-DD. */
export function motdToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is the shape the rest of this file compares and stores.
  return new Intl.DateTimeFormat('en-CA', { timeZone: MOTD_TIME_ZONE }).format(now);
}

/** Days from the epoch to a YYYY-MM-DD date, as an integer. Negative before the series starts. */
function dayIndexFor(date: string): number {
  const [y, m, d] = date.split('-').map((part) => Number.parseInt(part, 10));
  const [ey, em, ed] = QUORA_MOTD_EPOCH.split('-').map((part) => Number.parseInt(part, 10));
  if ([y, m, d, ey, em, ed].some((n) => !Number.isFinite(n))) {
    throw new Error(`Message of the day: "${date}" is not a YYYY-MM-DD date.`);
  }
  // Both ends are midday UTC so a daylight-saving shift can never move the difference across a
  // day boundary and shift every day in the series by one for half the year.
  const ms = Date.UTC(y, m - 1, d, 12) - Date.UTC(ey, em - 1, ed, 12);
  return Math.round(ms / 86_400_000);
}

/** Deterministic 32-bit generator, so the same cycle always produces the same order. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * The order a pool is worked through on a given pass. Every message appears exactly once before
 * any of them appears twice, and the order changes from one pass to the next so the series does
 * not become a loop somebody can recite.
 */
function orderFor(length: number, cycle: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  // +1 so cycle 0 is not seeded with 0, which degenerates in the generator above.
  const random = seededRandom(cycle + 1);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * The message for one calendar day.
 *
 * The action rotates every day — Fireside, TI Radio, your 1%, and round again — so three days
 * running never ask for the same thing. Within an action, the pool is worked through in a shuffled
 * order with no repeat until it is exhausted. With ten messages per action and three actions, that
 * is thirty days before anything comes back, and it comes back in a different order.
 *
 * Days before the epoch are clamped to day one rather than refused, so the screen renders something
 * useful if it is opened early.
 */
export function quoraMotdFor(date: string): QuoraMotdPick {
  const rawIndex = dayIndexFor(date);
  const dayIndex = Math.max(0, rawIndex);

  const action = QUORA_MOTD_ACTIONS[dayIndex % QUORA_MOTD_ACTIONS.length];
  const pool = POOLS[action];
  if (pool.length === 0) {
    throw new Error(`Message of the day: the "${action}" pool is empty, so no message can be picked.`);
  }

  // How many times this action has come around, which is every third day.
  const turn = Math.floor(dayIndex / QUORA_MOTD_ACTIONS.length);
  const cycle = Math.floor(turn / pool.length);
  const slot = turn % pool.length;

  return {
    date,
    dayIndex,
    cycle,
    message: pool[orderFor(pool.length, cycle)[slot]],
  };
}

/** Today's message, and the days after it, for a screen that shows what is coming. */
export function quoraMotdSchedule(fromDate: string, days: number): QuoraMotdPick[] {
  const [y, m, d] = fromDate.split('-').map((part) => Number.parseInt(part, 10));
  return Array.from({ length: Math.max(0, days) }, (_, offset) => {
    const at = new Date(Date.UTC(y, m - 1, d + offset, 12));
    return quoraMotdFor(at.toISOString().slice(0, 10));
  });
}

/** Everything in the rotation, for a screen that lists the pool. */
export function quoraMotdAll(): QuoraMotdMessage[] {
  return QUORA_MOTD_ACTIONS.flatMap((action) => POOLS[action]);
}
