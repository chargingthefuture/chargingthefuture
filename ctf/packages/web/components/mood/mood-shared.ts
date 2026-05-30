// Shared constants, types, and helpers for the Mood web shell.
// Palette derives from design/.../survivor-hub/Mood.tsx.

export const COLOR = "#EC4899";
export const BG = "#0F1117";
export const SURFACE = "#161B27";
export const BORDER = "#1E2A3A";
export const TEXT = "#F9FAFB";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

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

export const CRISIS_RESOURCES = [
  { name: "National Hotline", number: "1-888-373-7888", available: "24/7" },
  { name: "Crisis Text Line", number: "Text HOME to 233733", available: "24/7" },
  { name: "RAINN Hotline", number: "1-800-656-4673", available: "24/7" },
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

// Mood check-ins are anonymous and rate-limited per device, keyed by a random
// client id persisted in localStorage (never tied to the account server-side).
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

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}
