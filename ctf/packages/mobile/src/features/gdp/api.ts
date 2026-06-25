// GDP API client for mobile — mirrors GET /api/gdp/report/current
// Only real backend fields are consumed; no fabricated figures.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).

import { authedFetchJson } from '../../auth/authedFetch';

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

// One registered recognition source's contribution to the live Community Value Index. Mirrors the web
// payload from GET /api/gdp/report/current; rendered as the per-source value breakdown.
export type GdpSourceContribution = {
  pluginSlug: string;
  label: string;
  valueIndex: number;
};

export type GdpReport = {
  publication: GdpPublication;
  metrics: GdpMetric[];
  // Optional so older payloads without the field still parse; the live report always includes it.
  sources?: GdpSourceContribution[];
};

type GdpCurrentResponse =
  | { ok: true; report: GdpReport }
  | { ok: true; report: null }
  | { ok: false; code?: string; message?: string };

export async function fetchGdpCurrentReport(): Promise<GdpReport | null> {
  const json = await authedFetchJson<GdpCurrentResponse>('/api/gdp/report/current');
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
