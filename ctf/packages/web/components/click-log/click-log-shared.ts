// Shared constants, types, and derivations for the ClickLog web shell.
// Palette derives from design/.../survivor-hub/ClickLog.tsx.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import type { ClickLogIncident } from "../../lib/click-log/types";

export const BRAND = "#EC4899";
export const BG = "#0F1117";
export const SURFACE = "#161B27";
export const BORDER = "#1E2A3A";
export const TEXT = "#F9FAFB";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

// Theme-aware chrome tokens for the ClickLog shell. Default keeps the shipped values (accent stays
// #EC4899); comic uses the shared comic surface tokens plus the ClickLog comic-ink accent. The solid
// #1E2A3A chrome border and #161B27 surface now come from the shared BORDER_SOLID/SURFACE slots.
export type ClickLogTokens = PluginShellTokens;

export function getClickLogTokens(theme: ThemeName): ClickLogTokens {
  const accent = theme === "comic" ? getAppAccent("click-log", "comic") : BRAND;
  return getPluginShellTokens(accent, theme);
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// Monday-based weekday index (Mon=0 … Sun=6).
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function startOfWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - weekdayIndex(d));
  return d;
}

export type ClickLogStats = {
  total: number;
  week: number;
  month: number;
  withNotes: number;
  withLocation: number;
  weekdayCounts: number[];
};

export function hasLocation(incident: ClickLogIncident): boolean {
  return typeof incident.metadata.latitude === "number" && typeof incident.metadata.longitude === "number";
}

function hasNotes(incident: ClickLogIncident): boolean {
  return Boolean(incident.metadata.notes && incident.metadata.notes.trim().length > 0);
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function deriveClickLogStats(incidents: ClickLogIncident[], now: Date = new Date()): ClickLogStats {
  const weekStart = startOfWeek(now);
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  let week = 0;
  let month = 0;
  let withNotes = 0;
  let withLocation = 0;

  for (const incident of incidents) {
    const created = new Date(incident.created_at);
    if (Number.isNaN(created.getTime())) continue;
    if (created >= weekStart) {
      week += 1;
      weekdayCounts[weekdayIndex(created)] += 1;
    }
    if (isSameMonth(created, now)) month += 1;
    if (hasNotes(incident)) withNotes += 1;
    if (hasLocation(incident)) withLocation += 1;
  }

  return { total: incidents.length, week, month, withNotes, withLocation, weekdayCounts };
}

export function formatIncidentTime(createdAt: string, now: Date = new Date()): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return createdAt;
  const time = created.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (created >= startToday) return `Today, ${time}`;
  if (created >= startYesterday) return `Yesterday, ${time}`;
  return `${created.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}
