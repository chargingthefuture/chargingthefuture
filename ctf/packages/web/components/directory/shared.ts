// Shared constants, types, and helpers for the Directory web shell.
// Palette and layout derive from design/.../survivor-hub/Directory.tsx.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#93C5FD";
export const SKILLS_HUNT_COLOR = "#FBBF24";
// App surface background as rendered by the mockup (the mockup's `BG`
// constant is dead code; every rendered surface uses #0F1117).
export const BG = "#0F1117";

// Theme-aware chrome tokens for the Directory shell. Default keeps the shipped values (accent
// stays #93C5FD); comic uses the shared comic surface tokens plus the Directory comic-ink accent.
export type DirectoryTokens = PluginShellTokens;

export function getDirectoryTokens(theme: ThemeName): DirectoryTokens {
  const accent = theme === "comic" ? getAppAccent("directory", "comic") : COLOR;
  return getPluginShellTokens(accent, theme);
}

export interface Member {
  id: string;
  name: string;
  sector: string;
  jobTitle: string;
  skills: string[];
  // Free-text skills nominated through Skills Hunt that are not yet in the taxonomy.
  // Rendered as muted "pending review" chips so a community-generated profile is never
  // empty. Optional so list payloads that omit it still typecheck.
  pendingSkills?: string[];
  claimedByUserId: string | null;
  // Every directory profile is sourced from a Quora profile, so the link is the
  // social proof and the way a viewer learns more before reaching out. Optional
  // on the type so list payloads that omit it still typecheck.
  profileUrl?: string | null;
  headline?: string | null;
  bio?: string | null;
  // 'community-generated' marks a profile nominated through Skills Hunt; invitedByUsername is
  // the nominating scout's handle. Both drive the "Community-generated profile / Nominated by
  // @handle" label. Optional so list payloads that omit them still typecheck.
  source?: string | null;
  invitedByUsername?: string | null;
}

export interface Sector {
  id: string;
  name: string;
}

export interface SkillsHuntRewardCard {
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  isActive: boolean;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
