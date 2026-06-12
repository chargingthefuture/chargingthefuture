// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetch, authedFetchJson } from '../../auth/authedFetch';

const BASE = '/api/weekly-performance';

export interface WeekRow {
  weekStartDate: string;
  weekEndDate: string;
  status: 'open' | 'locked' | 'published';
}

export interface WeekMetric {
  metricKey: string;
  metricValue: number;
  metricUnit: string;
  sourcePlugin: string;
}

export interface CurrentWeekResponse {
  ok: boolean;
  currentWeek: WeekRow | null;
  activeUsersLast7Days: number;
}

export interface WeeksResponse {
  ok: boolean;
  weeks: WeekRow[];
}

export interface MetricsResponse {
  ok: boolean;
  metrics: WeekMetric[];
}

export async function fetchWeeks(): Promise<WeeksResponse> {
  return authedFetchJson<WeeksResponse>(`${BASE}/weeks`);
}

export async function fetchCurrentWeek(): Promise<CurrentWeekResponse> {
  return authedFetchJson<CurrentWeekResponse>(`${BASE}/current-week`);
}

export async function fetchWeekMetrics(weekStartDate: string): Promise<MetricsResponse> {
  return authedFetchJson<MetricsResponse>(
    `${BASE}/metrics?weekStartDate=${encodeURIComponent(weekStartDate)}`,
  );
}

export interface WeekSelectionResponse {
  ok: boolean;
  selectedWeek?: WeekRow;
  message?: string;
}

// Admin-only: mark a week active. The server enforces the admin gate and the
// CSRF confirmation header; this mirrors the web admin's PUT call.
export async function selectActiveWeek(weekStartDate: string): Promise<WeekSelectionResponse> {
  const res = await authedFetch(`${BASE}/admin/week-selection`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ weekStartDate }),
  });
  const data = (await res.json()) as WeekSelectionResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.message ?? `week_selection_failed:${res.status}`);
  }
  return data;
}
