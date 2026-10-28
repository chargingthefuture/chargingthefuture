import { queryDb } from 'lib/db/postgres';
import { DAILY_MINUTES_CTE } from './action-minutes';

// Retention by sign-up month, for the adoption tab's two charts (owner-approved plan, Measures):
// the layer cake (members active each week, stacked by the month they signed up) and the retention
// curves (the share of each month's sign-ups active N weeks after signing up). A member is active in
// a week when they had a day with 30 or more action minutes in it, the same day the Retained count
// uses. Sign-up is a member's first sign-in. Counts only, never a named member.

export const RECENT_COHORTS = 5;
export const LAYER_WEEKS = 12;
export const CURVE_WEEKS = 12;
export const EARLIER = 'Earlier';

export type RetentionCohorts = {
  // Oldest first; the last RECENT_COHORTS are months (YYYY-MM), and EARLIER comes first when any
  // member signed up before them.
  cohorts: string[];
  sizes: Record<string, number>;
  // Monday of each week, oldest first, with members active that week per cohort.
  layers: { week: string; active: Record<string, number> }[];
  // Recent month cohorts only: share active (0 to 1) in weeks 0..CURVE_WEEKS-1 since sign-up. Each
  // week's share is over the members who have fully lived through that week, so a member who
  // signed up late in the month is not counted as inactive in a week they have not reached.
  curves: { cohort: string; points: { week: number; share: number }[] }[];
};

type LayerRow = { cohort: string; week: string; active: number };
type CurveRow = { cohort: string; week: number; active: number; eligible: number };
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
  rows: { layers: LayerRow[]; curves: CurveRow[]; sizes: SizeRow[] },
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
    return { week: iso(d), active: Object.fromEntries(cohorts.map((c) => [c, 0])) as Record<string, number> };
  });
  for (const row of rows.layers) {
    const layer = layers.find((l) => l.week === row.week);
    const key = bucket(row.cohort, months);
    if (layer && key in layer.active) layer.active[key] += Number(row.active);
  }

  const curves = months.map((cohort) => {
    const points = rows.curves
      .filter((r) => r.cohort === cohort && Number(r.eligible) > 0 && Number(r.week) < CURVE_WEEKS)
      .map((r) => ({ week: Number(r.week), share: Number(r.active) / Number(r.eligible) }))
      .sort((x, y) => x.week - y.week);
    return { cohort, points };
  });

  return { cohorts, sizes, layers, curves };
}

export async function readRetentionCohorts(now = new Date()): Promise<RetentionCohorts> {
  const months = recentMonths(now);
  const layerStart = monday(now);
  layerStart.setUTCDate(layerStart.getUTCDate() - 7 * (LAYER_WEEKS - 1));
  const from = new Date(Math.min(layerStart.getTime(), new Date(`${months[0]}-01T00:00:00Z`).getTime()));
  const params = [iso(from), iso(layerStart)];
  const base = `WITH ${DAILY_MINUTES_CTE},
     firsts AS (SELECT user_id, MIN(created_at) AS first_seen FROM login_events GROUP BY user_id),
     full_days AS (SELECT d.user_id, d.day, f.first_seen FROM daily d JOIN firsts f ON f.user_id = d.user_id WHERE d.minutes >= 30)`;
  const [layers, curves, sizes] = await Promise.all([
    queryDb<LayerRow>(
      `${base}
       SELECT to_char(date_trunc('month', first_seen), 'YYYY-MM') AS cohort,
              to_char(date_trunc('week', day), 'YYYY-MM-DD') AS week, COUNT(DISTINCT user_id)::int AS active
         FROM full_days WHERE day >= $2::date GROUP BY 1, 2`,
      params,
    ),
    // One row per sign-up month and week since sign-up: the members who have fully lived through
    // that week, and how many of them were active in it.
    queryDb<CurveRow>(
      `${base},
       weeks AS (SELECT generate_series(0, ${CURVE_WEEKS - 1}) AS week),
       eligible AS (
         SELECT f.user_id, to_char(date_trunc('month', f.first_seen), 'YYYY-MM') AS cohort, w.week
           FROM firsts f CROSS JOIN weeks w
          WHERE f.first_seen >= $1::date AND f.first_seen + (w.week + 1) * INTERVAL '7 days' <= NOW()
       )
       SELECT e.cohort, e.week, COUNT(*)::int AS eligible,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM full_days d
                 WHERE d.user_id = e.user_id
                   AND FLOOR((d.day - (d.first_seen AT TIME ZONE 'UTC')::date) / 7) = e.week
              ))::int AS active
         FROM eligible e GROUP BY 1, 2`,
      [params[0]],
    ),
    queryDb<SizeRow>(
      `SELECT to_char(date_trunc('month', first_seen), 'YYYY-MM') AS cohort, COUNT(*)::int AS members
         FROM (SELECT MIN(created_at) AS first_seen FROM login_events GROUP BY user_id) f GROUP BY 1`,
    ),
  ]);
  return shapeRetention(now, { layers: layers.rows, curves: curves.rows, sizes: sizes.rows });
}
