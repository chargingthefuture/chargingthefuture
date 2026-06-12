// Shared constants, types, and helpers for the Weekly Performance web shell.
// Palette derives from design/.../survivor-hub/WeeklyPerformance.tsx.
// Types mirror the shapes returned by lib/weekly-performance/repository.ts
// (which exports inferred return types rather than named types).

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const BRAND = "#6366F1";
export const BG = "#0F1117";
export const SURFACE = "#161B27";
export const BORDER = "#1E2A3A";
export const TEXT = "#F9FAFB";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

// Theme-aware chrome tokens for the Weekly Performance shell. The shell paints a few neutral
// white-alpha button surfaces (the back button and the export button use rgba(255,255,255,0.05),
// which is not in the shared token set), so BTN_BG carries that one extra default value. The
// default theme returns the shipped values so it renders identically when the comic toggle is off;
// comic uses the shared comic surfaces plus the Weekly Performance comic-ink accent.
export type WeeklyPerformanceTokens = PluginShellTokens & {
  BTN_BG: string; // neutral control surface (default rgba(255,255,255,0.05))
};

export function getWeeklyPerformanceTokens(theme: ThemeName): WeeklyPerformanceTokens {
  if (theme === "comic") {
    const accent = getAppAccent("weekly-performance", "comic");
    return {
      ...getPluginShellTokens(accent, theme),
      BTN_BG: "#141414", // comic-surface
    };
  }
  return {
    ...getPluginShellTokens(BRAND, theme),
    BTN_BG: "rgba(255,255,255,0.05)",
  };
}

export type WeekStatus = "open" | "locked" | "published";

export type WpWeek = {
  weekStartDate: string;
  weekEndDate: string;
  status: WeekStatus;
};

export type WpMetric = {
  metricKey: string;
  metricValue: number;
  metricUnit: string;
  sourcePlugin: string;
};

export type WpComparison = {
  baseWeek: string;
  compareWeek: string;
  base: WpMetric[];
  compare: WpMetric[];
};

export type CurrentWeekResponse = {
  ok: boolean;
  currentWeek: WpWeek | null;
  activeUsersLast7Days: number;
};

export type WeeksResponse = { ok: boolean; weeks: WpWeek[] };
export type MetricsResponse = { ok: boolean; metrics: WpMetric[] };
export type ComparisonResponse = { ok: boolean; comparison: WpComparison };
export type WeekSelectionResponse = { ok: boolean; selectedWeek?: WpWeek; message?: string };

// A week is "live" while open; locked/published weeks are closed.
export function isLiveWeek(week: WpWeek | null): boolean {
  return week?.status === "open";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(dateIso: string): { month: number; day: number; year: number } | null {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  return { month: d.getUTCMonth(), day: d.getUTCDate(), year: d.getUTCFullYear() };
}

// "May 19–25, 2025" style range label from a week's start/end ISO dates.
export function formatWeekRange(week: WpWeek): string {
  const start = parts(week.weekStartDate);
  const end = parts(week.weekEndDate);
  if (!start || !end) return `${week.weekStartDate} – ${week.weekEndDate}`;
  const startLabel = `${MONTHS[start.month]} ${start.day}`;
  const endLabel = start.month === end.month ? `${end.day}` : `${MONTHS[end.month]} ${end.day}`;
  return `${startLabel}–${endLabel}, ${end.year}`;
}

// Turn a snake/camel metric key into a readable label (no label column exists).
export function humanizeMetricKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatMetricValue(value: number, unit: string): string {
  const formatted = Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (!unit) return formatted;
  if (unit === "%" || unit === "x") return `${formatted}${unit}`;
  return `${formatted} ${unit}`;
}

export function formatDelta(delta: number, unit: string): string {
  const suffix = unit === "%" ? "%" : "";
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const magnitude = Number.isInteger(delta)
    ? Math.abs(delta).toLocaleString()
    : Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${sign}${magnitude}${suffix} vs last week`;
}
