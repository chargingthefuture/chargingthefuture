// Shared constants and types for the Skills Hunt admin/moderation shell.
import type { SkillsHuntSubmissionStatus } from "lib/skills-hunt/types";

export const COLOR = "#FBBF24";

export const STATUS_OPTIONS: Array<{ key: SkillsHuntSubmissionStatus; label: string; color: string }> = [
  { key: "pending",  label: "Pending",  color: "#F59E0B" },
  { key: "accepted", label: "Accepted", color: "#22C55E" },
  { key: "rejected", label: "Rejected", color: "#EF4444" },
  { key: "flagged",  label: "Flagged",  color: COLOR },
];

export const REJECT_REASONS = [
  "Insufficient social proof / Quora unverifiable",
  "Full name violates spec (2–100 alphanumeric+spaces)",
  "Skills don't match taxonomy and no valid proposed skill",
  "Suspected duplicate of an existing accepted submission",
  "Suspected trafficker / bad-faith actor",
  "Other (see notes)",
];

export type ReviewAction = "accept" | "reject" | "flag";

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
