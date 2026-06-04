// Shared constants, types, and helpers for the Directory web shell.
// Palette and layout derive from design/.../survivor-hub/Directory.tsx.

export const COLOR = "#3B82F6";
export const SKILLS_HUNT_COLOR = "#A855F7";
// App surface background as rendered by the mockup (the mockup's `BG`
// constant is dead code; every rendered surface uses #0F1117).
export const BG = "#0F1117";

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
