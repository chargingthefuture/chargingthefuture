// Shared constants, types, and helpers for the LevelUp web shell.
// Palette derives from design/.../survivor-hub/LevelUp.tsx.
// LevelUp is grant-only ("earn or earn nothing") — no UI ever spends/deducts a user's ServiceCredits.

export const GREEN = "#22C55E";
export const BG = "#0F1117";
export const SURFACE = "#161B27";
export const BORDER = "#1E2A3A";
export const MUTED = "#4B5563";
export const TEXT = "#E2E8F0";
export const SUBTLE = "#94A3B8";

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
  cancelled: "#EF4444",
  draft: MUTED,
};

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

export interface Milestone {
  id: string;
  name?: string;
  percentRelease?: number;
  requiredTask?: string;
  status?: string;
}

export interface Enrollment {
  cohortId: string;
  title: string;
  track?: string;
  trainerName?: string;
  milestones: Milestone[];
  completedCount: number;
}

export interface Wallet {
  availableBalance?: number;
  walletEscrowBalance?: number;
  levelupEscrowedBalance?: number;
}

export interface PendingValidation {
  milestoneId: string;
  learnerName?: string;
  task?: string;
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
  levelupEscrowedBalance: number;
  totalEarned: number;
  history: WalletHistoryEntry[];
}

export function idempotencyKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function enrollmentPct(enr: Enrollment): number {
  return enr.milestones.length > 0 ? Math.round((enr.completedCount / enr.milestones.length) * 100) : 0;
}
