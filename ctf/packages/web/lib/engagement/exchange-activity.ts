import { queryDb } from 'lib/db/postgres';
import { getContributorAccessConfig } from 'lib/contributor-access/repository';
import {
  DELIVERING_VALUE_EVENT_SOURCES,
  VALUE_EVENT_SOURCES,
  aggregateExpression,
} from 'lib/contributor-access/value-events';
import { EVENT_LABEL, EVENT_SOURCE_PLUGIN, effectiveWeight } from 'lib/contributor-access/weights';

// How many members delivered value on a day, against the 384 target.
//
// 384 is the sample size at which a reading generalizes to a population of five million, which is
// the estimate this project works from. So a day at 384 is evidence the arrangement holds at that
// scale. It is a day's worth of people, not a total to accumulate, and not the same people twice.
//
// This asks the Weavers of the Commons question of a single day. One definition, one set of
// weights, one attribution — all of it from lib/contributor-access/value-events.ts, which exists so
// the two readings cannot drift apart when a feature is added (owner directive, 2026-09-20). The
// badge sums a member's entire time here and grants something permanent the first time the total
// clears the threshold; this counts who delivered today and how many of them there were.
//
// One difference, stated rather than hidden. The badge scores every event, because it is already
// gated on five distinct counterparties and a member who only talks can never clear that however
// long they keep talking. The daily count has no such gate — a single event would put somebody on
// the day's roster — so it draws only on the events marked as delivering something: eleven of the
// thirteen. Finishing a course somebody else taught and posting in a cohort are both real, and
// neither is a thing another member received.
//
// Read-only. The per-day figure is a count of people; the roster carries a member id and that day's
// score and nothing else. No per-event breakdown is returned for a named member, because Foundation
// answered calls are among the fifteen and rule 132 keeps that participation internal.
//
// Reaching 384 in a day needs more than 384 approved members on the books, since nobody delivers
// every day. The target is a day's attendance, so the roster it draws from has to be larger than
// the target by whatever margin ordinary life imposes.

export type ExchangeDay = {
  day: string;
  members: number;
};

export type WeightedValueEvent = {
  key: string;
  label: string;
  plugin: string;
  weight: number;
  // Whether this one counts toward the day's number, or only toward the badge.
  delivers: boolean;
};

export type ExchangeContributor = {
  memberId: string;
  score: number;
};

export type ExchangeActivityReading = {
  readAt: string;
  target: number;
  today: number;
  bestDay: ExchangeDay | null;
  // The middle day of the last thirty, quiet days counted as the zeros they are. This is the live
  // figure: it moves from the first day anything happens, and half the days sit below it.
  typicalDay: number;
  // The middle day of the last year. The goal is this at or above the target, which means most
  // days in a year cleared it — an average would let a dozen huge days carry ten quiet months.
  yearMedian: number;
  // The longest run of consecutive days at or above the target within the last year. One quiet day
  // ends a run, which is the strictest reading of whether the target is actually being reached.
  longestRun: number;
  daysAtTarget: number;
  days: ExchangeDay[];
  todayRoster: ExchangeContributor[];
  events: WeightedValueEvent[];
};

export const DAILY_EXCHANGE_TARGET = 384;

// Everything that is weighted, with the weight in force right now, so an admin can read the
// definition off the screen instead of taking it on trust (owner directive, 2026-09-20). A weight
// of zero is shown rather than hidden: an event nobody has tuned up yet still counts as defined,
// and leaving it out would be the confusing thing.
export function listWeightedValueEvents(weights: Record<string, unknown>): WeightedValueEvent[] {
  return VALUE_EVENT_SOURCES.map((source) => ({
    key: source.key,
    label: EVENT_LABEL[source.key],
    plugin: EVENT_SOURCE_PLUGIN[source.key],
    weight: effectiveWeight(source.key, weights),
    delivers: source.delivers,
  })).sort((a, b) => {
    if (a.delivers !== b.delivers) return a.delivers ? -1 : 1;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.label.localeCompare(b.label);
  });
}

type DayRow = { day: string; members: string };
type RosterRow = { member_id: string; score: string };

function count(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numeric(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

async function tableExists(table: string): Promise<boolean> {
  const reg = await queryDb<{ reg: string | null }>(`SELECT to_regclass($1)::text AS reg`, [`public.${table}`]);
  return !!reg.rows[0]?.reg;
}

// Only the events whose tables this database actually has. A plugin that has not shipped here
// contributes nothing rather than failing the reading.
async function availableSources() {
  const checks = await Promise.all(
    DELIVERING_VALUE_EVENT_SOURCES.map(async (source) => {
      try {
        for (const table of source.tables) {
          if (!(await tableExists(table))) return null;
        }
        return source;
      } catch {
        return null;
      }
    }),
  );
  return checks.filter((source): source is (typeof DELIVERING_VALUE_EVENT_SOURCES)[number] => source !== null);
}

// One row per (member, day) across every available event, with that day's weighted score. The
// aggregate per event is the same expression the badge uses, so a day's score is the badge's
// arithmetic over a day instead of over a lifetime.
function memberDaysSql(sources: typeof DELIVERING_VALUE_EVENT_SOURCES, weights: Record<string, unknown>): string {
  const parts = sources.map((source) => {
    const weight = effectiveWeight(source.key, weights);
    return `SELECT member_id, (at AT TIME ZONE 'UTC')::date AS day,
                   (${aggregateExpression(source.aggregate)} * ${weight}) AS score
              FROM (${source.rowSql}) AS rows
             WHERE member_id IS NOT NULL AND at IS NOT NULL
             GROUP BY member_id, (at AT TIME ZONE 'UTC')::date`;
  });

  return `SELECT member_id, day, SUM(score) AS score
            FROM (${parts.join(' UNION ALL ')}) AS per_event
           GROUP BY member_id, day`;
}

// A day with nobody writes no row, so the gaps are filled rather than left for a reader to mistake
// for missing data. A quiet day is a real reading and shows as a zero.
function fillGaps(rows: ExchangeDay[], days: number): ExchangeDay[] {
  const byDay = new Map(rows.map((row) => [row.day, row.members]));
  const out: ExchangeDay[] = [];
  const today = new Date();

  for (let back = days - 1; back >= 0; back -= 1) {
    const at = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - back));
    const day = at.toISOString().slice(0, 10);
    out.push({ day, members: byDay.get(day) ?? 0 });
  }

  return out;
}

// The middle value, with quiet days included as zeros. Even counts take the lower of the two
// middle values rather than averaging them, so the figure is one a day actually had.
function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

// The longest stretch of days in a row that reached the target. A single day below it ends the run.
function longestRunAtTarget(days: ExchangeDay[], target: number): number {
  let best = 0;
  let run = 0;
  for (const day of days) {
    run = day.members >= target ? run + 1 : 0;
    if (run > best) {
      best = run;
    }
  }
  return best;
}

function emptyReading(window: number): ExchangeActivityReading {
  return {
    readAt: new Date().toISOString(),
    target: DAILY_EXCHANGE_TARGET,
    today: 0,
    bestDay: null,
    typicalDay: 0,
    yearMedian: 0,
    longestRun: 0,
    daysAtTarget: 0,
    days: fillGaps([], window),
    todayRoster: [],
    events: [],
  };
}

export async function readDailyExchangeActivity(days = 30): Promise<ExchangeActivityReading> {
  const window = Number.isFinite(days) && days > 0 ? Math.min(Math.trunc(days), 365) : 30;

  const sources = await availableSources();
  if (sources.length === 0) {
    return emptyReading(window);
  }

  const config = await getContributorAccessConfig();
  const memberDays = memberDaysSql(sources, config.weights);

  // A year is read even though thirty days are shown, because the year's middle day is the goal and
  // the longest run is read across it.
  const YEAR = 365;
  const recent = await queryDb<DayRow>(
    `
      SELECT day::text AS day, COUNT(DISTINCT member_id)::text AS members
        FROM (${memberDays}) AS member_days
       WHERE day > (NOW() AT TIME ZONE 'UTC')::date - $1::int
       GROUP BY day
       ORDER BY day
    `,
    [YEAR],
  );

  // Read across every day on record, not only the window on screen, so the best day does not fall
  // out of view and take the figure with it.
  const best = await queryDb<DayRow>(
    `
      SELECT day::text AS day, members::text AS members
        FROM (
          SELECT day, COUNT(DISTINCT member_id) AS members
            FROM (${memberDays}) AS member_days
           GROUP BY day
        ) AS per_day
       ORDER BY members DESC, day DESC
       LIMIT 1
    `,
  );

  const atTarget = await queryDb<{ days_at_target: string }>(
    `
      SELECT COUNT(*)::text AS days_at_target
        FROM (
          SELECT day, COUNT(DISTINCT member_id) AS members
            FROM (${memberDays}) AS member_days
           GROUP BY day
        ) AS per_day
       WHERE members >= $1::int
    `,
    [DAILY_EXCHANGE_TARGET],
  );

  const roster = await queryDb<RosterRow>(
    `
      SELECT member_id, score::text AS score
        FROM (${memberDays}) AS member_days
       WHERE day = (NOW() AT TIME ZONE 'UTC')::date
       ORDER BY score DESC, member_id
       LIMIT 500
    `,
  );

  const counted = recent.rows.map((row) => ({ day: row.day, members: count(row.members) }));
  const yearDays = fillGaps(counted, YEAR);
  const allDays = yearDays.slice(-window);

  const bestRow = best.rows[0];

  return {
    readAt: new Date().toISOString(),
    target: DAILY_EXCHANGE_TARGET,
    today: allDays[allDays.length - 1]?.members ?? 0,
    bestDay: bestRow ? { day: bestRow.day, members: count(bestRow.members) } : null,
    typicalDay: median(allDays.map((day) => day.members)),
    yearMedian: median(yearDays.map((day) => day.members)),
    longestRun: longestRunAtTarget(yearDays, DAILY_EXCHANGE_TARGET),
    daysAtTarget: count(atTarget.rows[0]?.days_at_target),
    days: allDays,
    todayRoster: roster.rows.map((row) => ({ memberId: row.member_id, score: numeric(row.score) })),
    events: listWeightedValueEvents(config.weights),
  };
}
