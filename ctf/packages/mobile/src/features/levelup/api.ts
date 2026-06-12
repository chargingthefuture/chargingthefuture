// LevelUp API client for mobile.
//
// Binds to real backend routes only:
//   GET /api/levelup/cohorts
//   GET /api/levelup/trainers
//   GET /api/levelup/achievements
//   GET /api/levelup/wallet
//   GET /api/service-credits/wallet
//
// No user-enrollment dashboard endpoint exists yet — active-enrollment banner
// is omitted from the mobile screen until a GET route is added.
//
// All calls go through authedFetchJson so the Clerk bearer token is attached and
// the base URL comes from runtime config (APP_URL).

import { authedFetchJson } from '../../auth/authedFetch';

const LEVELUP_BASE = '/api/levelup';
const SC_BASE = '/api/service-credits';

// ---------------------------------------------------------------------------
// Types — mirroring listCohorts() return shape from lib/levelup/repository.ts
// ---------------------------------------------------------------------------

export interface Cohort {
  id: string;
  title: string;
  description: string;
  track: string;
  seats: number;
  startDate: string;
  endDate: string;
  requiredCredits: number;
  materialsCost: number;
  deviceSupport: boolean;
  status: 'draft' | 'open' | 'active' | 'completed' | 'cancelled';
  allowNoDeposit: boolean;
  trainerSplitPercent: number;
  completionBonusCredits: number;
  createdByUserId: string;
  seatsAvailable: number;
  // trainerName — not returned by /cohorts list endpoint; omitted
  // tags/curriculum — not returned by /cohorts list endpoint; omitted
  // milestoneCount — not returned by /cohorts list endpoint; omitted
}

export interface CohortsResponse {
  ok: boolean;
  cohorts: Cohort[];
}

export interface Wallet {
  availableBalance: number;
  escrowBalance: number;
}

export interface WalletResponse {
  ok: boolean;
  wallet: Wallet;
}

// Trainers directory (read-only browse).
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

// Grant-only achievement badge.
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

// LevelUp grant-only wallet view: balance + credits earned/granted.
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

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export async function fetchCohorts(params?: {
  track?: string;
  status?: string;
}): Promise<Cohort[]> {
  const qs = new URLSearchParams();
  if (params?.track) qs.set('track', params.track);
  if (params?.status) qs.set('status', params.status);
  const endpoint = `${LEVELUP_BASE}/cohorts${qs.toString() ? `?${qs.toString()}` : ''}`;
  const data = await authedFetchJson<CohortsResponse>(endpoint);
  return data.cohorts ?? [];
}

export async function fetchWallet(): Promise<Wallet> {
  const data = await authedFetchJson<WalletResponse>(`${SC_BASE}/wallet`);
  return data.wallet;
}

export async function fetchTrainers(params?: { track?: string }): Promise<Trainer[]> {
  const qs = new URLSearchParams();
  if (params?.track) qs.set('track', params.track);
  const endpoint = `${LEVELUP_BASE}/trainers${qs.toString() ? `?${qs.toString()}` : ''}`;
  const data = await authedFetchJson<{ ok: boolean; trainers?: Trainer[] }>(endpoint);
  return data.trainers ?? [];
}

export async function fetchAchievements(): Promise<Achievement[]> {
  const data = await authedFetchJson<{ ok: boolean; achievements?: Achievement[] }>(
    `${LEVELUP_BASE}/achievements`,
  );
  return data.achievements ?? [];
}

export async function fetchWalletView(): Promise<WalletView> {
  const data = await authedFetchJson<{ ok: boolean; wallet: WalletView }>(`${LEVELUP_BASE}/wallet`);
  return data.wallet;
}
