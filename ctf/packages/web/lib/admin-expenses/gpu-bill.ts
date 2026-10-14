import { queryDb } from 'lib/db/postgres';
import { addDays, billWindow, fetchEndpointBill, isDaySettled, runpodEndpointIdsFromEnv, type BillDay, type FetchLike } from './runpod-billing';
import type { GpuBillDay, GpuBillState } from './gpu-bill-shared';

// The RunPod key that reads billing. Kept in this project's Infisical, never copied from One Percent's
// project. Optional: without it the screen keeps the figure typed on the RunPod line and says so.
export const RUNPOD_BILLING_KEY_SETTING = 'RUNPOD_BILLING_API_KEY';

type GpuBillConfig = { ok: true; apiKey: string; endpointIds: string[] } | { ok: false; reason: string; endpointIds: string[] };

export function readGpuBillConfig(env: Record<string, string | undefined> = process.env): GpuBillConfig {
  const endpointIds = runpodEndpointIdsFromEnv(env);
  const apiKey = (env[RUNPOD_BILLING_KEY_SETTING] ?? '').trim();
  if (!apiKey) {
    return { ok: false, endpointIds, reason: `The RunPod bill is not being read because ${RUNPOD_BILLING_KEY_SETTING} is not set. The RunPod line shows the figure typed by hand.` };
  }
  if (endpointIds.length === 0) {
    return { ok: false, endpointIds, reason: 'The RunPod bill is not being read because OLLAMA_BASE_URL is not a RunPod endpoint address. The RunPod line shows the figure typed by hand.' };
  }
  return { ok: true, apiKey, endpointIds };
}

// A settled day is written once and then left alone; a day RunPod may still add to is rewritten by
// every read. The WHERE on the update is what keeps a settled day from changing.
async function saveBillDays(days: BillDay[], readAt: Date): Promise<void> {
  for (const day of days) {
    await queryDb(
      `
        INSERT INTO admin_expense_gpu_bill_days (endpoint_id, bill_date, amount_usd, time_billed_ms, settled, read_at)
        VALUES ($1, $2::date, $3, $4, $5, $6)
        ON CONFLICT (endpoint_id, bill_date) DO UPDATE
        SET amount_usd = EXCLUDED.amount_usd, time_billed_ms = EXCLUDED.time_billed_ms,
            settled = EXCLUDED.settled, read_at = EXCLUDED.read_at
        WHERE admin_expense_gpu_bill_days.settled = FALSE
      `,
      [day.endpointId, day.billDate, day.amountUsd.toFixed(6), Math.round(day.timeBilledMs), isDaySettled(day.billDate, readAt), readAt.toISOString()],
    );
  }
}

export type GpuBillReadResult = { endpointIds: string[]; daysRead: number; readAt: string };

// Read every endpoint's bill and save it. Every endpoint is fetched before anything is written, so a
// failure on one never leaves a half-updated month.
export async function readGpuBillNow(fetchImpl: FetchLike = fetch as unknown as FetchLike, now: Date = new Date()): Promise<GpuBillReadResult> {
  const config = readGpuBillConfig();
  if (!config.ok) throw new Error(config.reason);
  const window = billWindow(now);
  const perEndpoint = await Promise.all(config.endpointIds.map((id) => fetchEndpointBill(id, window, config.apiKey, fetchImpl)));
  const days = perEndpoint.flat();
  await saveBillDays(days, now);
  return { endpointIds: config.endpointIds, daysRead: days.length, readAt: now.toISOString() };
}

type DayRow = { bill_date: string; amount_cents: string; settled: boolean };

// The screen's view of the bill, for the configured endpoints only. `today` is the UTC day.
export async function loadGpuBillState(today: string = new Date().toISOString().slice(0, 10)): Promise<GpuBillState> {
  const config = readGpuBillConfig();
  const empty: GpuBillState = {
    unavailableReason: config.ok ? null : config.reason,
    endpointIds: config.endpointIds,
    lastReadAt: null,
    last30DaysCents: null,
    last30DaysFrom: null,
    last30DaysTo: null,
    todayCents: null,
    recentDays: [],
  };
  if (!config.ok) return empty;

  const from = addDays(today, -30);
  const [daysResult, readResult] = await Promise.all([
    queryDb<DayRow>(
      `
        SELECT to_char(bill_date, 'YYYY-MM-DD') AS bill_date,
               ROUND(SUM(amount_usd) * 100)::text AS amount_cents,
               BOOL_AND(settled) AS settled
        FROM admin_expense_gpu_bill_days
        WHERE endpoint_id = ANY($1::text[]) AND bill_date BETWEEN $2::date AND $3::date
        GROUP BY bill_date
        ORDER BY bill_date DESC
      `,
      [config.endpointIds, from, today],
    ),
    queryDb<{ last_read_at: string | Date | null }>(
      `SELECT MAX(read_at) AS last_read_at FROM admin_expense_gpu_bill_days WHERE endpoint_id = ANY($1::text[])`,
      [config.endpointIds],
    ),
  ]);
  const lastRead = readResult.rows[0]?.last_read_at ?? null;
  if (lastRead === null || daysResult.rows.length === 0) return empty;

  const days: GpuBillDay[] = daysResult.rows.map((row) => ({ billDate: row.bill_date, amountCents: Number(row.amount_cents) || 0, settled: row.settled }));
  const fullDays = days.filter((day) => day.billDate < today);
  const todayRow = days.find((day) => day.billDate === today);
  return {
    ...empty,
    lastReadAt: lastRead instanceof Date ? lastRead.toISOString() : String(lastRead),
    last30DaysCents: fullDays.reduce((total, day) => total + day.amountCents, 0),
    last30DaysFrom: from,
    last30DaysTo: addDays(today, -1),
    todayCents: todayRow ? todayRow.amountCents : null,
    recentDays: days.slice(0, 7),
  };
}
