// Shared constants, types, and status mapping for the Unlock web shell.
// Palette derives from design/.../survivor-hub/Unlock.tsx.

import { CheckCircle, Clock, XCircle } from "lucide-react";
import type { UnlockReviewStatus } from "../../lib/unlock/types";

export const BRAND = "#10B981";
export const BG = "#0F1117";
export const SURFACE = "#161B27";
export const BORDER = "#1E2A3A";
export const TEXT = "#F9FAFB";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

export type DisplayStatus = "pending" | "approved" | "rejected";

export const STATUS_CONFIG: Record<DisplayStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "#F59E0B", bg: "rgba(245,158,11,0.08)", label: "Pending Review" },
  approved: { icon: CheckCircle, color: BRAND, bg: "rgba(16,185,129,0.08)", label: "Approved" },
  rejected: { icon: XCircle, color: "#EF4444", bg: "rgba(239,68,68,0.08)", label: "Rejected" },
};

// Map the API review status onto the three display states. `spam` is surfaced
// to the user the same way as `rejected` (re-submission allowed).
export function toDisplayStatus(reviewStatus: UnlockReviewStatus | null): DisplayStatus {
  if (reviewStatus === "approved") return "approved";
  if (reviewStatus === "rejected" || reviewStatus === "spam") return "rejected";
  return "pending";
}

export const UNLOCK_BENEFITS = [
  "Full Directory access",
  "Skills Hunt participation",
  "ServiceCredits trading",
  "Plugin marketplace",
  "GDP contribution",
];
