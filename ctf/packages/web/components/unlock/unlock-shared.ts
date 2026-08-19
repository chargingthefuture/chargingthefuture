// Shared constants, types, and status mapping for the Unlock web shell.
// Palette derives from design/.../survivor-hub/Unlock.tsx.

import { CheckCircle, Clock, XCircle } from "lucide-react";
import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import type { UnlockReviewStatus } from "../../lib/unlock/types";

export const BRAND = "#D946EF";
export const BG = "#0F1117";
export const SURFACE = "#161B27";
export const BORDER = "#1E2A3A";
export const TEXT = "#F9FAFB";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

// Theme-aware chrome tokens for the Unlock shell chrome (the submission and status views — the
// UnlockShell itself is a thin controller with no inline colors). Default keeps the shipped values
// (accent stays the green #10B981); comic uses the shared comic surface tokens plus the Unlock
// comic-ink accent. The shell paints a solid #1E2A3A chrome border and a #161B27 card surface that are
// distinct from the shared defaults, so each is carried as its own token to keep the default theme
// byte-for-byte identical.
export type UnlockTokens = PluginShellTokens & {
  BORDER_SOLID: string; // solid chrome border (default #1E2A3A)
  SURFACE_CARD: string; // raised card surface (default #161B27)
};

export function getUnlockTokens(theme: ThemeName): UnlockTokens {
  if (theme === "comic") {
    const accent = getAppAccent("unlock", "comic");
    return { ...getPluginShellTokens(accent, theme), BORDER_SOLID: "#D4C49A1A", SURFACE_CARD: "#141414" };
  }
  return { ...getPluginShellTokens(BRAND, theme), BORDER_SOLID: "#1E2A3A", SURFACE_CARD: "#161B27" };
}

export type DisplayStatus = "pending" | "approved" | "rejected";

export const STATUS_CONFIG: Record<DisplayStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "#F59E0B", bg: "rgba(245,158,11,0.08)", label: "Pending Review" },
  approved: { icon: CheckCircle, color: BRAND, bg: "rgba(16,185,129,0.08)", label: "Approved" },
  rejected: { icon: XCircle, color: "#EF4444", bg: "rgba(239,68,68,0.08)", label: "Rejected" },
};

// Map the API review status onto the three display states. `spam` and `duplicate` are surfaced to the
// user the same way as `rejected`. Both of those also restrict the account platform-wide, so the member
// is sent to the closed-account page before reaching most of the app; this mapping only covers the
// Unlock status screen, which stays reachable so they can always see their own state.
export function toDisplayStatus(reviewStatus: UnlockReviewStatus | null): DisplayStatus {
  if (reviewStatus === "approved") return "approved";
  if (reviewStatus === "rejected" || reviewStatus === "spam" || reviewStatus === "duplicate") return "rejected";
  return "pending";
}

// What full access actually means, in plain language — outcomes a new member cares about, not a
// list of plugin/feature names (which read as jargon and feel both overwhelming and incomplete).
// These read like the home-page prompts: each line quietly stands in for one or more plugins
// (housing → LightHouse, rides → TrustTransport, work/earn → Workforce + Directory + ServiceCredits,
// skills → SkillsHunt + LevelUp, "ask for anything" → the Commons + AI assistant).
export const UNLOCK_BENEFITS = [
  "A real community of survivors — and growing",
  "Find safe housing",
  "Get help with rides and transportation",
  "Find work and ways to earn",
  "Build skills with people who get it",
  "Ask for anything you need, anytime",
];
