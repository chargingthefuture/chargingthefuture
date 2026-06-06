// Shared constants and types for the GDP web shell.
// Palette/layout derive from design/.../survivor-hub/GDP.tsx.

export const COLOR = "#06B6D4";
export const BG = "#0F1117";

export interface GdpSector {
  name: string;
  color?: string;
  value: string;
  members: number;
}

export interface GdpCountry {
  country: string;
  flag: string;
  gdp: string;
  members: number;
}

export interface GdpMetrics {
  currentValue?: string;
  delta?: string;
  target?: string;
  progress?: string;
  countries?: string;
  members?: string;
  memberStats?: { v: string; l: string; c?: string }[];
  // True only when the published GDP figure is flagged a normalized USD estimate
  // (gdp_metric_snapshots.is_estimate). Drives the understated "Estimate" chip and
  // footnote on the headline figure. It is a community-wide morale/transparency
  // metric, never a per-user redemption value.
  isEstimate?: boolean;
}

export interface GdpReport {
  sectors: GdpSector[];
  countries: GdpCountry[];
  metrics: GdpMetrics;
}

// The raw per-metric rows the report API returns (see lib/gdp/repository.ts
// mapMetric). Used to read the is_estimate flag off the headline GDP metric.
export interface GdpMetricRow {
  metricKey: string;
  metricValue: number;
  dpSuppressed?: boolean;
  lawfulBasis?: string;
  sourcePlugin?: string;
  isEstimate?: boolean;
}

// The headline GDP metric key carried in gdp_metric_snapshots; only this metric
// (and any future metric flagged is_estimate) shows the estimate treatment.
export const GDP_HEADLINE_METRIC_KEY = "gdp_total_revenue";

// Shared copy for the estimate treatment (chip label + footnote). Kept here so the
// authenticated shell and any future public surface stay byte-identical and the
// legal wording cannot drift: it describes a community-wide normalized USD estimate,
// never a per-user redemption value.
export const GDP_ESTIMATE_CHIP_LABEL = "Estimate";
export const GDP_ESTIMATE_FOOTNOTE =
  "* USD total is a normalized estimate across currencies — a morale and transparency metric, not a financial ledger.";

export type GdpTab = "dashboard" | "map";

// Matches the design's sidebar filter list (no "By Phase" — that term is banned
// project-wide and is not present in the design mockup).
export const SIDEBAR_FILTERS = ["Global Overview", "By Sector", "By Country", "Projections"];
