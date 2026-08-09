// Shared constants, types, and helpers for the SkillsHunt web shell.
// Palette/layout derive from design/.../survivor-hub/SkillsHunt.tsx.
import { Search, Trophy, Target, Users } from "lucide-react";
import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import type {
  SkillsHuntRound,
  SkillsHuntLeaderboardItem,
  SkillsHuntLeaderboardMode,
  SkillsHuntAchievement,
  SkillsHuntNotification,
  SkillsHuntSubmission,
  SkillsHuntMissionWithProgress,
} from "lib/skills-hunt/types";

export type {
  SkillsHuntRound,
  SkillsHuntLeaderboardItem,
  SkillsHuntLeaderboardMode,
  SkillsHuntAchievement,
  SkillsHuntNotification,
  SkillsHuntSubmission,
  SkillsHuntMissionWithProgress,
};

export const COLOR = "#FACC15";
export const BG = "#0F1117";
export const BIO_MAX = 280;
export const MAX_SKILLS = 10;

// Theme-aware chrome tokens for the SkillsHunt shell. Default keeps the shipped values (accent
// stays #FACC15); comic uses the shared comic surface tokens plus the SkillsHunt comic-ink accent.
export type SkillsHuntTokens = PluginShellTokens;

export function getSkillsHuntTokens(theme: ThemeName): SkillsHuntTokens {
  const accent = theme === "comic" ? getAppAccent("skills-hunt", "comic") : COLOR;
  return getPluginShellTokens(accent, theme);
}

// Shape of one row from GET /api/skills-taxonomy/flattened. The picker needs the sector and skill
// names for its category list, and the job-title (occupation) name for the "add a profession's
// skills" shortcut; the full row type lives in lib/skills-taxonomy/types.ts.
export type TaxonomyFlattenedRow = {
  sectorName: string;
  jobTitleName: string;
  skillName: string;
};

// Group flattened taxonomy rows by occupation (job title) → de-duped, sorted skill names. Powers the
// optional "add a profession's skills" shortcut: picking a profession adds all of its skills at once.
export function groupSkillsByOccupation(rows: TaxonomyFlattenedRow[]): Record<string, string[]> {
  const byOccupation = new Map<string, Set<string>>();
  for (const row of rows) {
    const occupation = row.jobTitleName?.trim();
    const skill = row.skillName?.trim();
    if (!occupation || !skill) continue;
    let set = byOccupation.get(occupation);
    if (!set) {
      set = new Set<string>();
      byOccupation.set(occupation, set);
    }
    set.add(skill);
  }
  const result: Record<string, string[]> = {};
  for (const occupation of [...byOccupation.keys()].sort((a, b) => a.localeCompare(b))) {
    const skills = byOccupation.get(occupation);
    if (!skills) continue;
    result[occupation] = [...skills].sort((a, b) => a.localeCompare(b));
  }
  return result;
}

// Group flattened taxonomy rows into the picker's category → skills shape:
// sectorName → de-duped, sorted list of skill names. A skill that appears under
// multiple sectors is listed under each; that is fine — selecting the name selects it.
export function groupTaxonomyBySector(rows: TaxonomyFlattenedRow[]): Record<string, string[]> {
  const bySector = new Map<string, Set<string>>();
  for (const row of rows) {
    const sector = row.sectorName?.trim();
    const skill = row.skillName?.trim();
    if (!sector || !skill) continue;
    let set = bySector.get(sector);
    if (!set) {
      set = new Set<string>();
      bySector.set(sector, set);
    }
    set.add(skill);
  }
  const result: Record<string, string[]> = {};
  for (const sector of [...bySector.keys()].sort((a, b) => a.localeCompare(b))) {
    const skills = bySector.get(sector);
    if (!skills) continue;
    result[sector] = [...skills].sort((a, b) => a.localeCompare(b));
  }
  return result;
}

export const BADGE_META: Record<string, { emoji: string; desc: string }> = {
  "first-finder":         { emoji: "🔍", desc: "First accepted submission for a URL" },
  "diversity-champion":   { emoji: "🌍", desc: "Skills spanning 3+ sectors" },
  "rare-talent-scout":    { emoji: "💎", desc: "Found a rare skill (<50% recruited)" },
  "quality-contributor":  { emoji: "⭐", desc: "10 accepted with no admin edits" },
  "leaderboard-champion": { emoji: "🏆", desc: "Reached top 10 on the leaderboard" },
  "accepted-first":       { emoji: "✅", desc: "First accepted submission" },
  "accepted-five":        { emoji: "🎯", desc: "5 accepted submissions" },
  "accepted-ten":         { emoji: "🌟", desc: "10 accepted submissions" },
};

export function badgeMeta(code: string, fallbackDesc: string): { emoji: string; desc: string } {
  return BADGE_META[code] ?? { emoji: "🏅", desc: fallbackDesc };
}

export type Tab = "scout" | "leaderboard" | "missions" | "my-finds";

export const TABS: { key: Tab; icon: typeof Search; label: string }[] = [
  { key: "scout",       icon: Search, label: "Scout" },
  { key: "leaderboard", icon: Trophy, label: "Leaderboard" },
  { key: "missions",    icon: Target, label: "Missions" },
  { key: "my-finds",    icon: Users,  label: "My Finds" },
];

export function rankDisplay(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function rankColor(rank: number): string {
  if (rank === 1) return "#F59E0B";
  if (rank === 2) return "#9CA3AF";
  if (rank === 3) return "#CD7C2F";
  return "#6B7280";
}

export function submissionStatusStyle(status: string): { bg: string; color: string; border: string; label: string } {
  if (status === "accepted") return { bg: "#22C55E20", color: "#22C55E", border: "#22C55E40", label: "✓ Accepted" };
  if (status === "rejected") return { bg: "rgba(239,68,68,0.12)", color: "#EF4444", border: "rgba(239,68,68,0.3)", label: "✗ Rejected" };
  if (status === "flagged")  return { bg: `${COLOR}20`, color: COLOR, border: `${COLOR}40`, label: "⚑ Flagged" };
  return { bg: "rgba(255,165,0,0.15)", color: "#F59E0B", border: "rgba(255,165,0,0.3)", label: "⏳ Pending" };
}

export function initials(name: string): string {
  return name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
}
