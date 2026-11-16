// The daily credit audit log (admin-only, read-only): what the admin screen and its route share.
// No database access here, so the screen can import it. ServiceCredits are an internal credits unit,
// not money.
//
// It exists to catch one pattern: an asker who keeps passing over the members who answered "I can
// help" and picks the same few people, so the day's credit goes to friends instead of the members
// who offered. A flag is a question for a person to look at, never a finding.

/** One asker picking the same helper this many times or more marks every row of that pair. */
export const DAILY_CREDIT_REPEAT_PAIR_MIN = 3;

export const DAILY_CREDIT_LOG_PAGE_SIZE = 25;

export type DailyCreditHelpAnswer = { userId: string; answeredAt: string };

export type DailyCreditCardRecord = {
  day: string;
  cardId: string;
  askerUserId: string;
  chosenAt: string;
  /** Every member who answered "I can help" on the card, oldest first, the asker left out. */
  helpers: DailyCreditHelpAnswer[];
  pickedUserId: string | null;
  confirmedAt: string | null;
  creditStatus: 'held' | 'granted' | null;
  grantedAt: string | null;
};

export type DailyCreditLogRow = DailyCreditCardRecord & {
  /** The picked member was the first to answer "I can help". */
  pickedFirst: boolean;
  /** The picked member answered "I can help" at all (a PeerProgramming or SocketRelay close may not). */
  pickedAnswered: boolean;
  /** How many closed cards this asker gave to this same helper, across the log. */
  pairCount: number;
  flagged: boolean;
};

export type DailyCreditAskerSummary = {
  askerUserId: string;
  closed: number;
  distinctHelpers: number;
  pickedNotFirst: number;
};

export type DailyCreditHelperSummary = {
  helperUserId: string;
  granted: number;
  held: number;
  distinctAskers: number;
};

export type DailyCreditRepeatPair = { askerUserId: string; helperUserId: string; count: number };

export type DailyCreditSummaries = {
  askers: DailyCreditAskerSummary[];
  helpers: DailyCreditHelperSummary[];
  repeatPairs: DailyCreditRepeatPair[];
};

const pairKey = (asker: string, helper: string) => `${asker}\u0000${helper}`;

function firstHelperId(record: DailyCreditCardRecord): string | null {
  return record.helpers[0]?.userId ?? null;
}

/** The picked member was somebody other than the first who answered "I can help". */
export function pickedSomeoneElse(record: DailyCreditCardRecord): boolean {
  const first = firstHelperId(record);
  return record.pickedUserId !== null && first !== null && record.pickedUserId !== first;
}

function countPairs(closed: DailyCreditCardRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of closed) {
    if (!record.pickedUserId) continue;
    const key = pairKey(record.askerUserId, record.pickedUserId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function summarizeAskers(closed: DailyCreditCardRecord[]): DailyCreditAskerSummary[] {
  const byAsker = new Map<string, { closed: number; helpers: Set<string>; pickedNotFirst: number }>();
  for (const record of closed) {
    const entry = byAsker.get(record.askerUserId) ?? { closed: 0, helpers: new Set<string>(), pickedNotFirst: 0 };
    entry.closed += 1;
    if (record.pickedUserId) entry.helpers.add(record.pickedUserId);
    if (pickedSomeoneElse(record)) entry.pickedNotFirst += 1;
    byAsker.set(record.askerUserId, entry);
  }
  return [...byAsker]
    .map(([askerUserId, entry]) => ({ askerUserId, closed: entry.closed, distinctHelpers: entry.helpers.size, pickedNotFirst: entry.pickedNotFirst }))
    .sort((a, b) => b.closed - a.closed || b.pickedNotFirst - a.pickedNotFirst || a.askerUserId.localeCompare(b.askerUserId));
}

function summarizeHelpers(closed: DailyCreditCardRecord[]): DailyCreditHelperSummary[] {
  const byHelper = new Map<string, { granted: number; held: number; askers: Set<string> }>();
  for (const record of closed) {
    if (!record.pickedUserId) continue;
    const entry = byHelper.get(record.pickedUserId) ?? { granted: 0, held: 0, askers: new Set<string>() };
    if (record.creditStatus === 'held') entry.held += 1;
    else entry.granted += 1;
    entry.askers.add(record.askerUserId);
    byHelper.set(record.pickedUserId, entry);
  }
  return [...byHelper]
    .map(([helperUserId, entry]) => ({ helperUserId, granted: entry.granted, held: entry.held, distinctAskers: entry.askers.size }))
    .sort((a, b) => b.granted + b.held - (a.granted + a.held) || a.distinctAskers - b.distinctAskers || a.helperUserId.localeCompare(b.helperUserId));
}

/** Summaries over every closed card (a picked helper), whatever page is on screen. */
export function summarizeDailyCredits(closed: DailyCreditCardRecord[]): DailyCreditSummaries {
  const picked = closed.filter((record) => record.pickedUserId !== null);
  const repeatPairs = [...countPairs(picked)]
    .filter(([, count]) => count >= DAILY_CREDIT_REPEAT_PAIR_MIN)
    .map(([key, count]) => {
      const [askerUserId, helperUserId] = key.split('\u0000');
      return { askerUserId, helperUserId, count };
    })
    .sort((a, b) => b.count - a.count);
  return { askers: summarizeAskers(picked), helpers: summarizeHelpers(picked), repeatPairs };
}

/** Marks each row on the page against the pair counts from the entire log. */
export function toDailyCreditLogRows(page: DailyCreditCardRecord[], closed: DailyCreditCardRecord[]): DailyCreditLogRow[] {
  const counts = countPairs(closed);
  return page.map((record) => {
    const pairCount = record.pickedUserId ? (counts.get(pairKey(record.askerUserId, record.pickedUserId)) ?? 0) : 0;
    return {
      ...record,
      pickedFirst: record.pickedUserId !== null && record.pickedUserId === firstHelperId(record),
      pickedAnswered: record.pickedUserId !== null && record.helpers.some((helper) => helper.userId === record.pickedUserId),
      pairCount,
      flagged: pairCount >= DAILY_CREDIT_REPEAT_PAIR_MIN,
    };
  });
}

/** Every member id the screen names, so the route resolves only those. */
export function dailyCreditLogMemberIds(rows: DailyCreditLogRow[], summaries: DailyCreditSummaries): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.askerUserId);
    if (row.pickedUserId) ids.add(row.pickedUserId);
    row.helpers.forEach((helper) => ids.add(helper.userId));
  }
  summaries.askers.forEach((entry) => ids.add(entry.askerUserId));
  summaries.helpers.forEach((entry) => ids.add(entry.helperUserId));
  return [...ids];
}

export function dailyCreditPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / DAILY_CREDIT_LOG_PAGE_SIZE));
}

/** A requested page number, clamped to the pages that exist; anything unreadable is page 1. */
export function clampDailyCreditPage(raw: string | null, total: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, dailyCreditPageCount(total));
}

export function dailyCreditStatusLabel(row: Pick<DailyCreditCardRecord, 'pickedUserId' | 'creditStatus' | 'grantedAt'>): string {
  if (!row.pickedUserId) return 'Not closed';
  if (row.creditStatus === 'held') return 'Held for Unlock';
  return row.grantedAt ? 'Granted' : 'Granting';
}
