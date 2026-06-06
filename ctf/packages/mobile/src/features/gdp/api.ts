// GDP API client for mobile — mirrors GET /api/gdp/report/current
// Only real backend fields are consumed; no fabricated figures.

import { Platform } from 'react-native';

const API_BASE: string =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : 'http://localhost:3000';

export type GdpMetric = {
  metricKey: string;
  metricValue: number;
  dpSuppressed: boolean;
  lawfulBasis: string;
  sourcePlugin: string;
  // True only when this aggregate figure is a normalized USD estimate across
  // currencies (gdp_metric_snapshots.is_estimate). Drives the "Estimate" chip and
  // footnote; it is a community-wide morale/transparency metric, never a per-user
  // redemption value. Optional so older payloads without the field default to false.
  isEstimate?: boolean;
};

export type GdpPublication = {
  id: string;
  weekStartDate: string;
  title: string;
  summary: string;
  status: 'draft' | 'published';
};

export type GdpReport = {
  publication: GdpPublication;
  metrics: GdpMetric[];
};

type GdpCurrentResponse =
  | { ok: true; report: GdpReport }
  | { ok: true; report: null }
  | { ok: false; code?: string; message?: string };

export async function fetchGdpCurrentReport(authToken?: string): Promise<GdpReport | null> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const res = await fetch(`${API_BASE}/api/gdp/report/current`, { headers });
  if (!res.ok) {
    throw new Error(`GDP fetch failed: ${res.status}`);
  }
  const json: GdpCurrentResponse = await res.json();
  if (!json.ok || !json.report) {
    return null;
  }
  return json.report;
}

/** Extract a named metric value; returns null if not present or DP-suppressed. */
export function pickMetric(metrics: GdpMetric[], key: string): number | null {
  const m = metrics.find((x) => x.metricKey === key);
  if (!m || m.dpSuppressed) return null;
  return m.metricValue;
}

/**
 * True only when the named aggregate metric is flagged a normalized USD estimate.
 * Used to show the understated "Estimate" chip/footnote on the headline GDP figure.
 */
export function pickMetricIsEstimate(metrics: GdpMetric[], key: string): boolean {
  const m = metrics.find((x) => x.metricKey === key);
  return m?.isEstimate === true;
}
