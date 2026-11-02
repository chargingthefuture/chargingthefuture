import { queryDb } from 'lib/db/postgres';
import { dailyMinutesCte } from './action-minutes';
import type { Signups } from './signups';

// Retention by sign-up month, for the adoption tab's two charts (owner-approved plan, Measures):
// the layer cake (members who signed in each week, stacked by the month they signed up) and the
// retention curves (the share of each month's sign-ups who signed in N weeks after signing up).
// Counts only, never a named member.
//
// Each chart carries two readings side by side, never labeled as each other (owner decisions,
// 2026-11-02): signed in (a login_events row that week) and active (a day with 30 or more action
// minutes that week, the same day the Retained count uses). A sign-in alone can flatter the
// picture, so it is always shown against active. Action minutes have only been recorded since
// 2026-10-27, so active reads 0 for every week before that.
//
// Sign-up is the account's creation date at the auth provider, the same roster the Unlock admin
// counts, without demo/test accounts. The sign-in record starts at a member's first recorded
// sign-in and misses everybody who signed up before it was kept. If the provider cannot be read,
// the charts fall back to the first recorded sign-in and say so (lib/measures/signups.ts).

export const RECENT_COHORTS = 5;
export const LAYER_WEEKS = 12;
export const CURVE_WEEKS = 12;
export const EARLIER = 'Earlier';

export type RetentionCohorts = {
  // Oldest first; the last RECENT_COHORTS are months (YYYY-MM), and EARLIER comes first when any
  // member signed up before them.
  cohorts: string[];
  sizes: Record<string, number>;
  // Monday of each week, oldest first, with members who signed in that week per cohort, and how
  // many members were active that week in all.
  layers: { week: string; signedIn: Record<string, number>; active: number }[];
  // Recent month cohorts only: share who signed in and share active (0 to 1) in weeks 0..CURVE_WEEKS-1 since sign-up. Each
  // week's share is over the members who have fully lived through that week, so a member who
  // signed up late in the month is not counted as absent in a week they have not reached.
  curves: { cohort: string; points: { week: number; signedInShare: number; activeShare: number }[] }[];
  // Where sign-up dates came from: the auth provider's account list, or (when it could not be read)
  // each member's first recorded sign-in, with the reason.
  source: Signups['source'];
};

type LayerRow = { cohort: string; week: string; signedIn: number };
type ActiveRow = { week: string; active: number };
type CurveRow = { cohort: string; week: number; signedIn: number; active: number; eligible: number };
type SizeRow = { cohort: string; members: number };

function monday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function recentMonths(now: Date): string[] {
  return Array.from({ length: RECENT_COHORTS }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (RECENT_COHORTS - 1 - i), 1));
    return iso(d).slice(0, 7);
  });
}

function bucket(cohort: string, months: string[]): string {
  return months.includes(cohort) ? cohort : EARLIER;
}

// Pure shaping, kept apart from the reads so it is tested without a database.
export function shapeRetention(
  now: Date,
  rows: { layers: LayerRow[]; active?: ActiveRow[]; curves: CurveRow[]; sizes: SizeRow[] },
  source: RetentionCohorts['source'] = { kind: 'provider' },
): RetentionCohorts {
  const months = recentMonths(now);
  const sizes: Record<string, number> = {};
  for (const row of rows.sizes) {
    const key = bucket(row.cohort, months);
    sizes[key] = (sizes[key] ?? 0) + Number(row.members);
  }
  const cohorts = [...(sizes[EARLIER] ? [EARLIER] : []), ...months];

  const firstWeek = monday(now);
  firstWeek.setUTCDate(firstWeek.getUTCDate() - 7 * (LAYER_WEEKS - 1));
  const layers = Array.from({ length: LAYER_WEEKS }, (_, i) => {
    const d = new Date(firstWeek);
    d.setUTCDate(d.getUTCDate() + 7 * i);
    return { week: iso(d), signedIn: Object.fromEntries(cohorts.map((c) => [c, 0])) as Record<string, number>, active: 0 };
  });
  for (const row of rows.layers) {
    const layer = layers.find((l) => l.week === row.week);
    const key = bucket(row.cohort, months);
    if (layer && key in layer.signedIn) layer.signedIn[key] += Number(row.signedIn);
  }
  for (const row of rows.active ?? []) {
    const layer = layers.find((l) => l.week === row.week);
    if (layer) layer.active += Number(row.active);
  }

  const curves = months.map((cohort) => {
    const points = rows.curves
      .filter((r) => r.cohort === cohort && Number(r.eligible) > 0 && Number(r.week) < CURVE_WEEKS)
      .map((r) => ({
        week: Number(r.week),
        signedInShare: Number(r.signedIn) / Number(r.eligible),
        activeShare: Number(r.active ?? 0) / Number(r.eligible),
      }))
      .sort((x, y) => x.week - y.week);
    return { cohort, points };
  });

  return { cohorts, sizes, layers, curves, source };
}

export async function readRetentionCohorts(signups: Signups, now = new Date()): Promise<RetentionCohorts> {
  const months = recentMonths(now);
  const layerStart = monday(now);
  layerStart.setUTCDate(layerStart.getUTCDate() - 7 * (LAYER_WEEKS - 1));
  const from = new Date(Math.min(layerStart.getTime(), new Date(`${months[0]}-01T00:00:00Z`).getTime()));
  // $1 account ids, $2 their sign-up times, $3 the first day read, $4 the first layer week.
  const params = [signups.ids, signups.dates, iso(from), iso(layerStart)];
  const base = `WITH signups AS (
       SELECT s.user_id, s.signed_up_at,
              to_char(date_trunc('month', s.signed_up_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS cohort
         FROM unnest($1::text[], $2::timestamptz[]) AS s(user_id, signed_up_at)
     ),
     seen AS (
       SELECT DISTINCT l.user_id, (l.created_at AT TIME ZONE 'UTC')::date AS day
         FROM login_events l JOIN signups s ON s.user_id = l.user_id
        WHERE l.created_at >= $3::date
     ),
     ${dailyMinutesCte('$3')},
     active_days AS (SELECT d.user_id, d.day FROM daily d JOIN signups s ON s.user_id = d.user_id WHERE d.minutes >= 30)`;
  const [layers, active, curves] = await Promise.all([
    queryDb<LayerRow>(
      `${base}
       SELECT s.cohort, to_char(date_trunc('week', d.day), 'YYYY-MM-DD') AS week, COUNT(DISTINCT d.user_id)::int AS "signedIn"
         FROM seen d JOIN signups s ON s.user_id = d.user_id
        WHERE d.day >= $4::date GROUP BY 1, 2`,
      params,
    ),
    queryDb<ActiveRow>(
      `${base}
       SELECT to_char(date_trunc('week', day), 'YYYY-MM-DD') AS week, COUNT(DISTINCT user_id)::int AS active
         FROM active_days WHERE day >= $4::date GROUP BY 1`,
      params,
    ),
    // One row per sign-up month and week since sign-up: the members who have fully lived through
    // that week, how many of them signed in during it, and how many were active in it.
    queryDb<CurveRow>(
      `${base},
       weeks AS (SELECT generate_series(0, ${CURVE_WEEKS - 1}) AS week),
       eligible AS (
         SELECT s.user_id, s.cohort, s.signed_up_at, w.week
           FROM signups s CROSS JOIN weeks w
          WHERE s.signed_up_at >= $3::date AND s.signed_up_at + (w.week + 1) * INTERVAL '7 days' <= NOW()
       )
       SELECT e.cohort, e.week, COUNT(*)::int AS eligible,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM seen d
                 WHERE d.user_id = e.user_id
                   AND FLOOR((d.day - (e.signed_up_at AT TIME ZONE 'UTC')::date) / 7) = e.week
              ))::int AS "signedIn",
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM active_days a
                 WHERE a.user_id = e.user_id
                   AND FLOOR((a.day - (e.signed_up_at AT TIME ZONE 'UTC')::date) / 7) = e.week
              ))::int AS active
         FROM eligible e GROUP BY 1, 2`,
      params.slice(0, 3),
    ),
  ]);
  const sizes = new Map<string, number>();
  for (const date of signups.dates) {
    const cohort = date.slice(0, 7);
    sizes.set(cohort, (sizes.get(cohort) ?? 0) + 1);
  }
  return shapeRetention(
    now,
    { layers: layers.rows, active: active.rows, curves: curves.rows, sizes: [...sizes].map(([cohort, members]) => ({ cohort, members })) },
    signups.source,
  );
}
