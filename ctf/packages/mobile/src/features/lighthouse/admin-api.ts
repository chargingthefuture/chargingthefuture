import { Platform } from 'react-native';
import type { LighthouseMatch } from './types';

export type LighthouseMatchStatus = LighthouseMatch['status'];

// Admin client for the LightHouse plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/lighthouse/admin/*. Admin access is enforced
// server-side; a 401/403 surfaces as a "forbidden" notice in the screen.
const ADMIN_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/lighthouse/admin'
    : 'http://localhost:3000/api/lighthouse/admin';

export type LighthouseAdminStats = {
  seekers: number;
  hosts: number;
  properties: number;
  activeMatches: number;
  completedMatches: number;
  generatedAtIso: string;
};

export type StatsFetchResult = {
  ok: boolean;
  forbidden: boolean;
  stats: LighthouseAdminStats | null;
  message: string | null;
};

export type MatchesFetchResult = {
  ok: boolean;
  forbidden: boolean;
  items: LighthouseMatch[];
  message: string | null;
};

// GET admin counts. Returns forbidden:true for non-admins.
export async function fetchAdminStats(authToken: string): Promise<StatsFetchResult> {
  const res = await fetch(`${ADMIN_API_BASE}/stats`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, stats: null, message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, stats: null, message: `Could not load stats (${res.status}).` };
  }
  const data = (await res.json()) as { stats?: LighthouseAdminStats };
  return { ok: true, forbidden: false, stats: data.stats ?? null, message: null };
}

// GET the full match list for moderation. Admin gated.
export async function fetchAdminMatches(authToken: string): Promise<MatchesFetchResult> {
  const res = await fetch(`${ADMIN_API_BASE}/matches`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, items: [], message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, items: [], message: `Could not load matches (${res.status}).` };
  }
  const data = (await res.json()) as { items?: LighthouseMatch[] };
  return { ok: true, forbidden: false, items: data.items ?? [], message: null };
}

// PUT a new status for a match. Carries the CSRF confirmation header the API requires.
export async function updateAdminMatchStatus(
  authToken: string,
  matchId: string,
  status: LighthouseMatchStatus,
): Promise<LighthouseMatch> {
  const res = await fetch(`${ADMIN_API_BASE}/matches/${matchId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`match_update_failed:${res.status}`);
  }
  const data = (await res.json()) as { match: LighthouseMatch };
  return data.match;
}
