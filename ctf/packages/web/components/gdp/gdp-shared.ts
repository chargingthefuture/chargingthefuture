// Shared constants and types for the GDP web shell.
// Palette/layout derive from design/.../survivor-hub/GDP.tsx.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#06B6D4";
export const BG = "#0F1117";

// Theme-aware chrome tokens for the GDP shell. Default keeps the shipped values (accent
// stays #06B6D4); comic uses the shared comic surface tokens plus the GDP comic-ink accent.
export type GdpTokens = PluginShellTokens;

export function getGdpTokens(theme: ThemeName): GdpTokens {
  const accent = theme === "comic" ? getAppAccent("gdp", "comic") : COLOR;
  return getPluginShellTokens(accent, theme);
}

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

// Real aggregate metric keys carried in gdp_metric_snapshots and surfaced on the
// world map. These are community-wide aggregates only — never per-user figures.
export const GDP_ACTIVE_MEMBERS_METRIC_KEY = "weekly_active_users";

// Recognized service activity denominated in ServiceCredits — the platform's
// non-redeemable utility token. Shown alongside the USD GDP, always in SC units and
// NEVER converted to a dollar value (no fiat peg). It reflects community mutual-aid
// activity so the USD figure alone does not understate self-sufficiency.
export const GDP_RECOGNIZED_SC_METRIC_KEY = "gdp_recognized_volume_sc";

// Format a USD aggregate into the compact $B/$M/$K form the design uses. Returns a
// dash when the figure is absent so the map never invents a number.
export function formatGdpUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

// Format a member/people count into compact M/K form. Returns a dash when absent.
export function formatGdpCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

// Format a ServiceCredits amount into compact M/K form with the "SC" unit. Returns a
// dash when absent. Never prefixed with a currency symbol — ServiceCredits is not fiat.
export function formatGdpServiceCredits(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M SC`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K SC`;
  return `${value.toLocaleString()} SC`;
}

// Pull a single metric value out of the raw report metric rows. Returns null when
// the metric is absent so callers render an honest empty state, never a fake value.
export function pickGdpMetricValue(
  rows: GdpMetricRow[] | undefined,
  metricKey: string,
): number | null {
  if (!Array.isArray(rows)) return null;
  const row = rows.find((m) => m && m.metricKey === metricKey);
  return row ? row.metricValue : null;
}

// Matches the design's sidebar filter list (no "By Phase" — that term is banned
// project-wide and is not present in the design mockup).
export const SIDEBAR_FILTERS = ["Global Overview", "By Sector", "By Country", "Projections"];
