import { createHash } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { recognizeCommunityValueIndex } from 'lib/gdp/recognition';

// How much the Community Value Index grew this week, for the Our numbers card on Today ("+N
// Community Value Index this week"). The index is a running total, so a week's growth needs a
// reading kept from last week: this stores the current week's reading in gdp_metric_snapshots
// (metric `gdp_value_index`, the row and id scripts/recognizeGdp.mjs writes, last reading of the
// week wins) and answers the live index less last week's row. With no row for last week it answers
// null and the card leaves the figure out rather than show the running total as one week's growth.
// The index is a relative measure, never money: no currency symbol, no price.

const METRIC_KEY = 'gdp_value_index';

// Read again at most this often per server, so Today does not recompute the index on every open.
const KEEP_MS = 10 * 60_000;

let kept: { weekStart: string; atMs: number; change: number | null } | null = null;

export function weekStartIso(now: Date): string {
  const day = now.getUTCDay();
  const back = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back)).toISOString().slice(0, 10);
}

export function previousWeekStartIso(weekStart: string): string {
  const at = new Date(`${weekStart}T00:00:00Z`);
  return new Date(at.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
}

// The same id recognizeGdp.mjs gives the week's row, so the two never write two rows for one week.
export function snapshotId(weekStart: string): string {
  return createHash('sha256').update(`${weekStart}${METRIC_KEY}gdp`).digest('hex').slice(0, 32);
}

// This week's growth from the live index and last week's stored reading; never below zero, since a
// reading that went down (a corrected record) is not growth to show.
export function weeklyChange(live: number, lastWeek: number | null): number | null {
  if (lastWeek === null || !Number.isFinite(lastWeek)) return null;
  return Math.max(0, Math.round(live) - Math.round(lastWeek));
}

async function storeReading(weekStart: string, value: number): Promise<void> {
  await queryDb(
    `INSERT INTO gdp_metric_snapshots (id, week_start_date, metric_key, metric_value, dp_suppressed, lawful_basis, source_plugin, is_estimate)
     VALUES ($1, $2::date, $3, $4, false, 'service-delivery', 'gdp', true)
     ON CONFLICT (id) DO UPDATE SET metric_value = EXCLUDED.metric_value, is_estimate = EXCLUDED.is_estimate`,
    [snapshotId(weekStart), weekStart, METRIC_KEY, value],
  );
}

async function lastWeekReading(weekStart: string): Promise<number | null> {
  const result = await queryDb<{ v: string | null }>(
    `SELECT metric_value::text AS v FROM gdp_metric_snapshots
      WHERE metric_key = $1 AND week_start_date = $2::date
      ORDER BY created_at DESC LIMIT 1`,
    [METRIC_KEY, previousWeekStartIso(weekStart)],
  );
  const value = result.rows[0]?.v;
  return value == null ? null : Number(value);
}

export async function readWeeklyIndexChange(now = new Date()): Promise<number | null> {
  const weekStart = weekStartIso(now);
  if (kept && kept.weekStart === weekStart && now.getTime() - kept.atMs < KEEP_MS) return kept.change;
  const [breakdown, lastWeek] = await Promise.all([recognizeCommunityValueIndex(), lastWeekReading(weekStart)]);
  const live = Math.round(breakdown.valueIndex);
  await storeReading(weekStart, live);
  const change = weeklyChange(live, lastWeek);
  kept = { weekStart, atMs: now.getTime(), change };
  return change;
}
