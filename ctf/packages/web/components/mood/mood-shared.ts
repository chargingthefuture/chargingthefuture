// Shared constants, types, and helpers for the Mood web shell.
// Palette derives from design/.../survivor-hub/Mood.tsx.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#BEF264";
export const BG = "#0F1117";
export const SURFACE = "#161B27";
export const BORDER = "#1E2A3A";
export const TEXT = "#F9FAFB";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

// Theme-aware chrome tokens for the Mood shell. The default theme keeps the shipped
// values so default-dark renders pixel-identical: the accent stays the shell's shipped
// pink #EC4899 (not the registry's mood.standard green — the shell has always rendered
// pink, and pixel-identical default wins). The comic theme uses the shared comic surface
// tokens plus the Mood comic-ink accent. Mood paints a solid #1E2A3A chrome border in
// some places, carried as BORDER_SOLID (default #1E2A3A, comic comic-border-faint), and a
// solid #161B27 card surface carried as SURFACE (default #161B27, comic comic-surface).
export type MoodTokens = PluginShellTokens & { BORDER_SOLID: string; SURFACE: string };

export function getMoodTokens(theme: ThemeName): MoodTokens {
  if (theme === "comic") {
    const accent = getAppAccent("mood", "comic");
    return { ...getPluginShellTokens(accent, theme), BORDER_SOLID: "#D4C49A1A", SURFACE: "#141414" };
  }
  return { ...getPluginShellTokens(COLOR, theme), BORDER_SOLID: "#1E2A3A", SURFACE: "#161B27" };
}

export type Tab = "checkin" | "community";

export type MoodOption = {
  emoji: string;
  label: string;
  value: number;
  color: string;
};

export const MOODS: MoodOption[] = [
  { emoji: "😄", label: "Great", value: 5, color: "#22C55E" },
  { emoji: "🙂", label: "Good", value: 4, color: "#84CC16" },
  { emoji: "😐", label: "Okay", value: 3, color: "#F59E0B" },
  { emoji: "😔", label: "Low", value: 2, color: "#F97316" },
  { emoji: "😢", label: "Struggling", value: 1, color: "#EF4444" },
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Eligibility response from GET /api/mood/eligibility?clientId=…
export type MoodEligibility = {
  ok: boolean;
  eligible: boolean;
  cooldownUntilIso: string | null;
  lastSubmissionAtIso: string | null;
};

const CLIENT_ID_KEY = "ctf.mood.clientId";

// Each check-in still carries a random client id persisted in localStorage and
// sent with the request, but the 7-day cooldown is enforced server-side on the
// authenticated account, not on this client id.
export function getMoodClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const generated = (window.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    window.localStorage.setItem(CLIENT_ID_KEY, generated);
    return generated;
  } catch {
    return "";
  }
}

// Community Pulse response from GET /api/mood/community. Aggregate only — no
// per-user data is ever returned by the backend.
export type MoodCommunityPulseDay = {
  dateIso: string;
  averageMood: number | null;
  count: number;
};

export type MoodCommunityPulse = {
  windowDays: number;
  minSample: number;
  totalCount: number;
  averageMood: number | null;
  hasEnoughData: boolean;
  days: MoodCommunityPulseDay[];
};

export type MoodCommunityResponse = {
  ok: boolean;
  pulse: MoodCommunityPulse;
};

// Map a 1..5 average mood to the matching emoji + label + color for display.
export function moodFaceForAverage(avg: number | null): { emoji: string; label: string; color: string } {
  if (avg === null || Number.isNaN(avg)) return { emoji: "·", label: "No data", color: SUBTLE };
  const rounded = Math.max(1, Math.min(5, Math.round(avg)));
  const match = MOODS.find((m) => m.value === rounded);
  return match ? { emoji: match.emoji, label: match.label, color: match.color } : { emoji: "·", label: "No data", color: SUBTLE };
}

// Short weekday label (Mon, Tue, …) for a yyyy-mm-dd date string, in UTC so it
// lines up with the server's day buckets.
export function weekdayLabel(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}
