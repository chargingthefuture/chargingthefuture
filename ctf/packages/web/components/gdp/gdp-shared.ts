// Shared constants and types for the GDP web shell.
// Palette/layout derive from design/.../survivor-hub/GDP.tsx.

import { PLATFORM_LAUNCH_DATE_ISO } from "@/lib/platform/launch";
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
  // Optional member count. The live per-source breakdown has no per-source member count, so it is left
  // unset and the "{n} members" sub-label is hidden; the (currently unused) published-report path may set it.
  members?: number;
  // Optional bar fill 0..1 (the source's share of the largest contribution). Falls back to a neutral
  // width when unset so the published-report path renders unchanged.
  share?: number;
}

// A real per-country row for the "Top Countries" panel — member distribution read from claimed
// directory profiles (location tied to people). `members` is the real count; `share` is that count
// as a percentage of all located members. No invented per-country money figure.
export interface GdpCountry {
  country: string;
  members: number;
  share: number;
  // True only for the synthetic "Location not set" bucket (active members with no country recorded), so
  // the panel can style it apart from a real country and exclude it from the distinct-country count.
  unspecified?: boolean;
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

// Total signed-up members, carried as a live metric row alongside the value index and surfaced on the
// dashboard hero and the world-map overlay. Community-wide count only — never a per-user figure.
export const GDP_TOTAL_MEMBERS_METRIC_KEY = "total_members";

// The Community Value Index — one composite measure of all recognized economic
// activity, folding every value type (fiat, crypto, ServiceCredits, barter) into a
// single relative figure. It is NOT money: shown as a plain number with no currency
// symbol, and never a price or redemption value for any currency or token.
export const COMMUNITY_VALUE_INDEX_METRIC_KEY = "gdp_value_index";

// On-screen label and the plain-language disclaimer (one source of truth so the legal
// wording cannot drift across surfaces). The plugin stays "GDP"; this reframes the
// figure as a custom, community-specific measure in the spirit of GDP.
export const COMMUNITY_VALUE_INDEX_LABEL = "Community Value Index";
export const COMMUNITY_VALUE_INDEX_DISCLAIMER =
  "Community Value is one measure of all the value exchanged in this community — money, crypto, ServiceCredits, and barter — combined through a fixed set of weights. It's a relative index for transparency, in the spirit of GDP. It isn't money, a price, or an exchange or redemption value for any currency or token.";

// The date the index counts from. The index is cumulative — every recognition source sums its full
// table history with no time window (lib/gdp/recognition.ts), so the honest anchor is the platform
// launch date. That date now lives in the platform-owned constant `PLATFORM_LAUNCH_DATE_ISO`
// (lib/platform/launch.ts) because Weekly Performance needs the same value; change it there and
// every surface follows.
export const COMMUNITY_VALUE_INDEX_SINCE_DATE_ISO = PLATFORM_LAUNCH_DATE_ISO;
export const COMMUNITY_VALUE_INDEX_SINCE_LABEL = "Cumulative since June 12, 2026";

// The projected figure: what the posts already on the board would add IF every one of them closed
// successfully. It is a separate number from the Community Value Index and is never added to it — the
// index counts only exchanges that actually completed. Kept here as its own metric key/label/disclaimer
// so the wording cannot drift between surfaces, and so no surface can show the projected figure without
// the sentence that says what it is.
export const PROJECTED_VALUE_METRIC_KEY = "gdp_projected_value_index";
export const PROJECTED_VALUE_LABEL = "Value waiting to happen";
export const PROJECTED_VALUE_DISCLAIMER =
  "This is what the posts already on the board would add if every one of them closed successfully — rides and deliveries still open, quotes waiting on an answer, requests nobody has done yet, recurring activities waiting to be confirmed. Most posts never close, so treat it as interest, not achievement. It is not part of the Community Value Index, and like the index it isn't money, a price, or a redemption value.";

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

// Format the Community Value Index into compact M/K form. NEVER prefixed with a
// currency symbol — the index is a relative measure, not money. Returns a dash when
// absent so the surface never invents a number.
export function formatCommunityValueIndex(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
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

// One registered recognition source's contribution to the live Community Value Index, as returned by
// GET /api/gdp/report/current. The dashboard renders these as the per-source value breakdown.
export interface GdpLiveSource {
  pluginSlug: string;
  label: string;
  valueIndex: number;
}

// One projection source's contribution — open posts that have not closed yet, per plugin. Carried in
// its own payload field, never mixed into `metrics` or `sources`, so the projected figure can never be
// read as recognized value.
export interface GdpProjectedSource {
  pluginSlug: string;
  label: string;
  valueIndex: number;
  openCount: number;
}

// The projected block from GET /api/gdp/report/current. Absent/null when the projection read failed, in
// which case the panel is simply not rendered.
export interface GdpProjection {
  projectedValueIndex: number;
  openPostCount: number;
  perSource: GdpProjectedSource[];
}

// The live report payload from GET /api/gdp/report/current: live metric rows plus the per-source
// breakdown and an optional narrative. Computed on each request — there is no published-snapshot read.
export interface GdpReportPayload {
  publication?: { id: string; weekStartDate: string; title: string; summary: string; status: string } | null;
  metrics: GdpMetricRow[];
  sources?: GdpLiveSource[];
  projection?: GdpProjection | null;
}

// Shape the live metric rows into the GdpMetrics the hero/sidebar render. The headline is the Community
// Value Index (no currency symbol); member stats come from the live total/active rows. Any absent row is
// simply omitted so the surface shows an honest figure, never a fabricated one.
export function shapeLiveGdpMetrics(rows: GdpMetricRow[], isEstimate: boolean): GdpMetrics {
  const valueIndex = pickGdpMetricValue(rows, COMMUNITY_VALUE_INDEX_METRIC_KEY);
  const totalMembers = pickGdpMetricValue(rows, GDP_TOTAL_MEMBERS_METRIC_KEY);
  const memberStats: { v: string; l: string; c?: string }[] = [];
  if (totalMembers !== null) memberStats.push({ v: formatGdpCount(totalMembers), l: "Members" });
  return {
    currentValue: valueIndex !== null ? formatCommunityValueIndex(valueIndex) : undefined,
    members: totalMembers !== null ? formatGdpCount(totalMembers) : undefined,
    memberStats,
    isEstimate,
  };
}

// Shape the projected per-source rows for the panel: drop sources with nothing open (so the panel never
// shows an empty bar), largest first, with the bar scaled to the biggest contributor. Returns an empty
// list when nothing is open anywhere, which hides the panel entirely.
export function shapeProjectedSources(sources: GdpProjectedSource[] | undefined): GdpProjectedSource[] {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((s) => Number.isFinite(s.valueIndex) && s.valueIndex > 0)
    .sort((a, b) => b.valueIndex - a.valueIndex);
}

// Shape the per-source breakdown into sector rows (largest first). Bars are scaled to the biggest
// contributor; sources with no recognized value are dropped so the panel never shows an empty bar.
export function shapeSourceSectors(sources: GdpLiveSource[] | undefined): GdpSector[] {
  if (!Array.isArray(sources)) return [];
  const contributing = sources.filter((s) => Number.isFinite(s.valueIndex) && s.valueIndex > 0);
  const max = contributing.reduce((m, s) => Math.max(m, s.valueIndex), 0);
  return [...contributing]
    .sort((a, b) => b.valueIndex - a.valueIndex)
    .map((s) => ({
      name: s.label,
      value: formatCommunityValueIndex(s.valueIndex),
      share: max > 0 ? s.valueIndex / max : 0,
    }));
}
