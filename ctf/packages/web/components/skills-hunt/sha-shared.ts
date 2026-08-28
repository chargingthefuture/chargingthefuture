// Shared constants and types for the SkillsHunt admin/moderation shell.
import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import type { SkillsHuntSubmissionStatus } from "lib/skills-hunt/types";

export const COLOR = "#FACC15";

// Theme-aware chrome tokens for the SkillsHunt admin panels. Default keeps the shipped values
// (accent stays #FACC15); comic uses the shared comic surface tokens plus the SkillsHunt
// comic-ink accent. Mirrors getSkillsHuntTokens in sh-shared.ts (click-log precedent).
export type SkillsHuntAdminTokens = PluginShellTokens;

export function getSkillsHuntAdminTokens(theme: ThemeName): SkillsHuntAdminTokens {
  const accent = theme === "comic" ? getAppAccent("skills-hunt", "comic") : COLOR;
  return getPluginShellTokens(accent, theme);
}

// 'removed' is not a submission status — it is the soft-delete marker, offered here as a filter so
// a removed nomination is findable. Before this it appeared under no filter at all, while still
// being able to hold a Quora URL against a re-nomination.
export type SkillsHuntAdminStatusFilter = SkillsHuntSubmissionStatus | "removed";

export const STATUS_OPTIONS: Array<{ key: SkillsHuntAdminStatusFilter; label: string; color: string }> = [
  { key: "pending",  label: "Pending",  color: "#F59E0B" },
  { key: "accepted", label: "Accepted", color: "#22C55E" },
  { key: "rejected", label: "Rejected", color: "#EF4444" },
  { key: "flagged",  label: "Flagged",  color: COLOR },
  { key: "removed",  label: "Removed",  color: "#94A3B8" },
];

const REJECT_REASONS = [
  "Insufficient social proof / Quora unverifiable",
  "Full name violates spec (2–100 alphanumeric+spaces)",
  "Skills don't match taxonomy and no valid proposed skill",
  "Suspected duplicate of an existing accepted submission",
  "Suspected trafficker / bad-faith actor",
  "Other (see notes)",
];

export type ReviewAction = "accept" | "reject" | "flag" | "unflag";

// Prompts for a reject reason (numbered pick or free text). Returns null if the
// moderator cancels.
export function promptRejectReason(): string | null {
  if (typeof window === "undefined") return null;
  const numbered = REJECT_REASONS.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const choice = window.prompt(`Reject reason (1-${REJECT_REASONS.length}) or free text:\n${numbered}`, "1");
  if (choice == null) return null;
  const idx = Number.parseInt(choice, 10);
  if (Number.isInteger(idx) && idx >= 1 && idx <= REJECT_REASONS.length) return REJECT_REASONS[idx - 1];
  return choice.trim() || null;
}
