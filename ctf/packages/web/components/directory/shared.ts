// Shared constants, types, and helpers for the Directory web shell.
// Palette and layout derive from design/.../survivor-hub/Directory.tsx.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#3B82F6";
export const SKILLS_HUNT_COLOR = "#A855F7";
// App surface background as rendered by the mockup (the mockup's `BG`
// constant is dead code; every rendered surface uses #0F1117).
export const BG = "#0F1117";

// Theme-aware chrome tokens for the Directory shell. Default keeps the shipped values (accent
// stays #3B82F6); comic uses the shared comic surface tokens plus the Directory comic-ink accent.
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
  claimedByUserId: string | null;
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
