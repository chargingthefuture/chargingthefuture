import { queryDb } from 'lib/db/postgres';
import { getContributorAccessConfig } from 'lib/contributor-access/repository';
import { VALUE_EVENT_SOURCES, aggregateExpression } from 'lib/contributor-access/value-events';
import { effectiveWeight } from 'lib/contributor-access/weights';

// How many members delivered value on a day, against the 384 target.
//
// 384 is the sample size at which a reading generalizes to a population of five million, which is
// the estimate this project works from. So a day at 384 is evidence the arrangement holds at that
// scale. It is a day's worth of people, not a total to accumulate, and not the same people twice.
//
// This asks the Weavers of the Commons question of a single day. Same fourteen events, same weights,
// same attribution — all of it from lib/contributor-access/value-events.ts, which exists so the two
// readings cannot drift apart when a feature is added (owner directive, 2026-09-20). The badge sums
// a member's entire time here and grants something permanent the first time the total clears the
// threshold; this counts who delivered today and how many of them there were.
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

export type ExchangeContributor = {
  memberId: string;
  score: number;
};

export type ExchangeActivityReading = {
  readAt: string;
  target: number;
  today: number;
  bestDay: ExchangeDay | null;
  daysAtTarget: number;
  days: ExchangeDay[];
  todayRoster: ExchangeContributor[];
};

export const DAILY_EXCHANGE_TARGET = 384;

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
    VALUE_EVENT_SOURCES.map(async (source) => {
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
  return checks.filter((source): source is (typeof VALUE_EVENT_SOURCES)[number] => source !== null);
}

// One row per (member, day) across every available event, with that day's weighted score. The
// aggregate per event is the same expression the badge uses, so a day's score is the badge's
// arithmetic over a day instead of over a lifetime.
function memberDaysSql(sources: typeof VALUE_EVENT_SOURCES, weights: Record<string, unknown>): string {
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

function emptyReading(window: number): ExchangeActivityReading {
  return {
    readAt: new Date().toISOString(),
    target: DAILY_EXCHANGE_TARGET,
    today: 0,
    bestDay: null,
    daysAtTarget: 0,
    days: fillGaps([], window),
    todayRoster: [],
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

  const recent = await queryDb<DayRow>(
    `
      SELECT day::text AS day, COUNT(DISTINCT member_id)::text AS members
        FROM (${memberDays}) AS member_days
       WHERE day > (NOW() AT TIME ZONE 'UTC')::date - $1::int
       GROUP BY day
       ORDER BY day
    `,
    [window],
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

  const allDays = fillGaps(
    recent.rows.map((row) => ({ day: row.day, members: count(row.members) })),
    window,
  );

  const bestRow = best.rows[0];

  return {
    readAt: new Date().toISOString(),
    target: DAILY_EXCHANGE_TARGET,
    today: allDays[allDays.length - 1]?.members ?? 0,
    bestDay: bestRow ? { day: bestRow.day, members: count(bestRow.members) } : null,
    daysAtTarget: count(atTarget.rows[0]?.days_at_target),
    days: allDays,
    todayRoster: roster.rows.map((row) => ({ memberId: row.member_id, score: numeric(row.score) })),
  };
}
