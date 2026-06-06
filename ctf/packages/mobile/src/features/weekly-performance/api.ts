import { Platform } from 'react-native';

const API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/weekly-performance'
    : 'http://localhost:3000/api/weekly-performance';

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
  const res = await fetch(`${API_BASE}/weeks`);
  if (!res.ok) throw new Error('Failed to fetch weeks');
  return res.json() as Promise<WeeksResponse>;
}

export async function fetchCurrentWeek(): Promise<CurrentWeekResponse> {
  const res = await fetch(`${API_BASE}/current-week`);
  if (!res.ok) throw new Error('Failed to fetch current week');
  return res.json() as Promise<CurrentWeekResponse>;
}

export async function fetchWeekMetrics(weekStartDate: string): Promise<MetricsResponse> {
  const res = await fetch(
    `${API_BASE}/metrics?weekStartDate=${encodeURIComponent(weekStartDate)}`,
  );
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json() as Promise<MetricsResponse>;
}

export interface WeekSelectionResponse {
  ok: boolean;
  selectedWeek?: WeekRow;
  message?: string;
}

// Admin-only: mark a week active. The server enforces the admin gate and the
// CSRF confirmation header; this mirrors the web admin's PUT call.
export async function selectActiveWeek(weekStartDate: string): Promise<WeekSelectionResponse> {
  const res = await fetch(`${API_BASE}/admin/week-selection`, {
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
