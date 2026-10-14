// Reading the RunPod bill for this product's own AI drafting endpoints. Pure apart from the one fetch,
// which is passed in, so every request this module builds can be checked in a test without a network.
//
// The RunPod account is shared with One Percent, a separate product. RunPod's older billing route
// (api.runpod.io/v2/billing/endpoints) returns totals for the entire account with no endpoint filter,
// so reading it would count One Percent's spending as this product's. Every request here goes to the
// REST route, names exactly one endpoint, and refuses an answer that carries a different endpoint.

export const RUNPOD_BILLING_URL = 'https://rest.runpod.io/v1/billing/endpoints';

// The settings that hold this product's Ollama addresses. A RunPod serverless address looks like
// https://api.runpod.ai/v2/<endpoint-id>, so the endpoint ids come from these and are never typed in
// a second time. Add a name here if the product ever drafts from a second endpoint.
export const OLLAMA_URL_SETTINGS = ['OLLAMA_BASE_URL'] as const;

const RUNPOD_SERVERLESS_HOST = 'api.runpod.ai';
const ENDPOINT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// The endpoint id in a RunPod serverless address, or null when the address is not one (a plain
// Ollama host, an empty setting, or text that is not an address).
export function runpodEndpointIdFromUrl(raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.hostname !== RUNPOD_SERVERLESS_HOST && !url.hostname.endsWith(`.${RUNPOD_SERVERLESS_HOST}`)) return null;
  const [version, endpointId] = url.pathname.split('/').filter(Boolean);
  if (version !== 'v2' || !endpointId || !ENDPOINT_ID_PATTERN.test(endpointId)) return null;
  return endpointId;
}

// Every distinct RunPod endpoint id named by the Ollama settings, in setting order.
export function runpodEndpointIdsFromEnv(env: Record<string, string | undefined>): string[] {
  const ids = OLLAMA_URL_SETTINGS.map((name) => runpodEndpointIdFromUrl(env[name])).filter((id): id is string => id !== null);
  return [...new Set(ids)];
}

// The days each read covers: today (UTC, still growing) and the 30 full days before it, so the
// monthly figure is always a complete 30 days after a single read.
export const BILL_WINDOW_FULL_DAYS = 30;

export type BillWindow = { startDate: string; endDate: string; startTime: string; endTime: string };

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDay(date);
}

export function billWindow(now: Date): BillWindow {
  const endDate = isoDay(now);
  const startDate = addDays(endDate, -BILL_WINDOW_FULL_DAYS);
  return { startDate, endDate, startTime: `${startDate}T00:00:00Z`, endTime: now.toISOString() };
}

// RunPod reports usage about an hour behind. A day is treated as final once it has been read at
// least this long after it ended; before that its row is rewritten by every read.
export const SETTLE_AFTER_MS = 3 * 60 * 60 * 1000;

export function isDaySettled(billDate: string, readAt: Date): boolean {
  const dayEnd = new Date(`${addDays(billDate, 1)}T00:00:00Z`).getTime();
  return readAt.getTime() >= dayEnd + SETTLE_AFTER_MS;
}

export function buildBillingRequestUrl(endpointId: string, window: BillWindow): string {
  if (!ENDPOINT_ID_PATTERN.test(endpointId)) {
    throw new Error(`"${endpointId}" is not a RunPod endpoint id, so the bill was not requested.`);
  }
  const url = new URL(RUNPOD_BILLING_URL);
  url.searchParams.set('bucketSize', 'day');
  url.searchParams.set('endpointId', endpointId);
  url.searchParams.set('grouping', 'endpointId');
  url.searchParams.set('startTime', window.startTime);
  url.searchParams.set('endTime', window.endTime);
  return url.toString();
}

export type BillDay = { endpointId: string; billDate: string; amountUsd: number; timeBilledMs: number };

type RawBucket = { amount?: unknown; time?: unknown; endpointId?: unknown; timeBilledMs?: unknown };

function bucketsOf(body: unknown): RawBucket[] {
  if (Array.isArray(body)) return body as RawBucket[];
  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: RawBucket[] }).data;
  }
  throw new Error('RunPod answered with something other than a list of billing days.');
}

function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// One bucket as a day and an amount. Throws when the bucket names another endpoint, because then the
// filter was not applied and the figures could include One Percent's spending.
function readBucket(bucket: RawBucket, endpointId: string): { day: string; amountUsd: number; timeBilledMs: number } {
  if (bucket.endpointId !== undefined && bucket.endpointId !== null && bucket.endpointId !== endpointId) {
    throw new Error(`RunPod returned billing for endpoint "${String(bucket.endpointId)}" when only "${endpointId}" was asked for, so none of it was saved.`);
  }
  const amountUsd = typeof bucket.amount === 'number' ? bucket.amount : Number.NaN;
  const day = typeof bucket.time === 'string' ? bucket.time.slice(0, 10) : '';
  if (!Number.isFinite(amountUsd) || amountUsd < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error('RunPod returned a billing day without a readable date and amount, so none of it was saved.');
  }
  return { day, amountUsd, timeBilledMs: finiteOrZero(bucket.timeBilledMs) };
}

// One row per day in the window for this endpoint. A day RunPod returned nothing for is zero: the
// endpoint scaled to nothing that day. Any bad bucket throws, so nothing from that answer is saved.
export function parseBillingResponse(body: unknown, endpointId: string, window: BillWindow): BillDay[] {
  const totals = new Map<string, { amountUsd: number; timeBilledMs: number }>();
  for (let day = window.startDate; day <= window.endDate; day = addDays(day, 1)) {
    totals.set(day, { amountUsd: 0, timeBilledMs: 0 });
  }
  for (const bucket of bucketsOf(body)) {
    const read = readBucket(bucket, endpointId);
    const current = totals.get(read.day);
    if (!current) continue; // outside the window asked for
    current.amountUsd += read.amountUsd;
    current.timeBilledMs += read.timeBilledMs;
  }
  return [...totals.entries()].map(([billDate, total]) => ({ endpointId, billDate, ...total }));
}

export type FetchLike = (input: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

const REQUEST_TIMEOUT_MS = 20_000;

export async function fetchEndpointBill(endpointId: string, window: BillWindow, apiKey: string, fetchImpl: FetchLike): Promise<BillDay[]> {
  const response = await fetchImpl(buildBillingRequestUrl(endpointId, window), {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    const hint = response.status === 401 || response.status === 403 ? ' The RunPod key was refused; check that it can read billing.' : '';
    throw new Error(`RunPod answered ${response.status} for endpoint ${endpointId}.${hint}${detail ? ` ${detail}` : ''}`);
  }
  return parseBillingResponse(await response.json(), endpointId, window);
}
