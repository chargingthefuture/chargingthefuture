// LevelUp API client for mobile.
//
// Binds to real backend routes only:
//   GET /api/levelup/cohorts
//   GET /api/service-credits/wallet
//
// No user-enrollment dashboard endpoint exists yet — active-enrollment banner
// is omitted from the mobile screen until a GET route is added.

import { Platform } from 'react-native';

function getApiOrigin(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env
      ? (process.env.EXPO_PUBLIC_API_ORIGIN ?? process.env.API_ORIGIN)
      : undefined;
  return fromEnv && fromEnv.length > 0 ? fromEnv.replace(/\/$/, '') : 'http://localhost:3000';
}

const LEVELUP_BASE =
  Platform.OS === 'web' ? '/api/levelup' : `${getApiOrigin()}/api/levelup`;

const SC_BASE =
  Platform.OS === 'web' ? '/api/service-credits' : `${getApiOrigin()}/api/service-credits`;

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
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error('Failed to fetch cohorts');
  const data = (await res.json()) as CohortsResponse;
  return data.cohorts ?? [];
}

export async function fetchWallet(): Promise<Wallet> {
  const res = await fetch(`${SC_BASE}/wallet`);
  if (!res.ok) throw new Error('Failed to fetch wallet');
  const data = (await res.json()) as WalletResponse;
  return data.wallet;
}
