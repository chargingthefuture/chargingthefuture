// Shared constants, types, and helpers for the SkillUp web shell.
// Palette derives from design/.../survivor-hub/SkillUp.tsx.
// SkillUp is grant-only ("earn or earn nothing") — no UI ever spends/deducts a user's ServiceCredits.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const GREEN = "#10B981";
export const BG = "#0F1117";
export const SURFACE = "#161B27";
export const BORDER = "#1E2A3A";
export const MUTED = "#4B5563";
export const TEXT = "#E2E8F0";
export const SUBTLE = "#94A3B8";

// Theme-aware chrome tokens for the SkillUp shell. Default keeps the shipped values (accent stays the
// green #10B981, painted as solid and as rgba(16,185,129,…) tints); comic uses the shared comic surface
// tokens plus the SkillUp comic-ink accent. SkillUp uses its own body/secondary text tones (#E2E8F0,
// #94A3B8) and a solid #1E2A3A chrome border, distinct from the shared defaults, so each is carried as
// its own token to keep the default theme byte-for-byte identical.
export type SkillUpTokens = PluginShellTokens & {
  BORDER_SOLID: string; // solid chrome border (default #1E2A3A)
  TEXT_BODY: string; // primary body text (default #E2E8F0)
  TEXT_SUBTLE: string; // secondary text (default #94A3B8)
  ACCENT_TINT_BG: string; // back-button / active-nav background tint (default 0.12)
  ACCENT_TINT_BORDER: string; // back-button icon border tint (default 0.3)
  ACCENT_NAV_BORDER: string; // active-nav border tint (default 0.4)
};

export function getSkillUpTokens(theme: ThemeName): SkillUpTokens {
  if (theme === "comic") {
    const accent = getAppAccent("skill-up", "comic");
    return {
      ...getPluginShellTokens(accent, theme),
      BORDER_SOLID: "#D4C49A1A",
      TEXT_BODY: "#EDE3CB",
      TEXT_SUBTLE: "#7A6A50",
      ACCENT_TINT_BG: `${accent}1F`,
      ACCENT_TINT_BORDER: `${accent}4D`,
      ACCENT_NAV_BORDER: `${accent}66`,
    };
  }
  return {
    ...getPluginShellTokens(GREEN, theme),
    BORDER_SOLID: "#1E2A3A",
    TEXT_BODY: "#E2E8F0",
    TEXT_SUBTLE: "#94A3B8",
    ACCENT_TINT_BG: "rgba(16,185,129,0.12)",
    ACCENT_TINT_BORDER: "rgba(16,185,129,0.3)",
    ACCENT_NAV_BORDER: "rgba(16,185,129,0.4)",
  };
}

export const TRACK_COLORS: Record<string, string> = {
  Tech: "#3B82F6",
  Finance: "#F59E0B",
  Wellness: "#14B8A6",
  "Life Skills": "#A855F7",
};

export const STATUS_COLOR: Record<string, string> = {
  open: GREEN,
  active: "#3B82F6",
  full: MUTED,
  completed: "#A855F7",
  canceled: "#EF4444",
  draft: MUTED,
};

// Preset track filter chips. Hidden from the Browse UI for now because this is a fixed, hardcoded list
// that does not reflect the cohorts that actually exist; kept here to restore as data-driven filters
// once cohorts are automated at scale (deferred — see #1197).
export const TRACKS = ["All Tracks", "Tech", "Finance", "Wellness", "Life Skills"];

export type NavKey = "browse" | "progress" | "trainers" | "achievements" | "wallet";

export interface Cohort {
  id: string;
  title: string;
  track?: string;
  trainerName?: string;
  seatsAvailable?: number;
  seats?: number;
  requiredCredits?: number;
  status?: string;
  milestoneCount?: number;
  tags?: string[];
  startDate?: string;
}

// One of the signed-in member's own enrollments, exactly as GET /api/skill-up/enrollments returns it.
// `isCurrent` is true while the enrollment is live (server statuses `enrolled` / `active`) and false
// once it is completed or dropped, so the Browse count can say how many cohorts you are in right now
// rather than how many you have ever joined.
export interface Enrollment {
  enrollmentId: string;
  cohortId: string;
  status: string;
  isCurrent: boolean;
  title: string;
  track?: string;
  trainerName?: string | null;
  milestoneTotal: number;
  milestoneCompleted: number;
}

export interface Wallet {
  availableBalance?: number;
  walletEscrowBalance?: number;
  skillUpEscrowedBalance?: number;
}

export interface Trainer {
  id: string;
  userId: string;
  displayName: string;
  headline: string;
  bio: string;
  tracks: string[];
  status: string;
  activeCohortCount: number;
}

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  track: string;
  icon: string;
  creditReward: number;
  sequenceNo: number;
  earned: boolean;
  earnedAtIso: string | null;
  grantedCredits: number;
}

export interface WalletHistoryEntry {
  kind: string;
  amount: number;
  label: string;
  earnedAtIso: string;
}

export interface WalletView {
  availableBalance: number;
  walletEscrowBalance: number;
  skillUpEscrowedBalance: number;
  totalEarned: number;
  history: WalletHistoryEntry[];
}

export function idempotencyKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function enrollmentPct(enr: Enrollment): number {
  return enr.milestoneTotal > 0 ? Math.round((enr.milestoneCompleted / enr.milestoneTotal) * 100) : 0;
}

// A cohort's track chip is worth showing only when it says something the title does not. Cohorts
// opened from the proposal queue take the occupation as BOTH their title and their track, so the
// card printed "Journalists / Reporters" and then a chip reading "Journalists / Reporters" directly
// under it — the same words twice on a phone-width row (owner report, 2026-08-29).
//
// Match on the normalized strings (case and surrounding whitespace ignored), and first drop a
// leading plugin-name prefix from the title so a row written before
// post/0009_skill_up_cohort_title_drop_plugin_prefix.sql runs ("LevelUp: Journalists / Reporters",
// or "SkillUp: …" after the rename) is recognized as the same repeat. Anything else — a track that
// genuinely categorizes a differently-named cohort — still shows its chip.
export function trackRepeatsTitle(title: string | null | undefined, track: string | null | undefined): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizedTrack = normalize(track ?? '');
  if (normalizedTrack.length === 0) {
    return false;
  }
  const normalizedTitle = normalize(title ?? '').replace(/^(?:level|skill)up:\s*/, '');
  return normalizedTitle === normalizedTrack;
}
