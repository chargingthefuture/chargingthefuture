import { authedFetch } from '../../auth/authedFetch';
import type { LighthouseMatch } from './types';

export type LighthouseMatchStatus = LighthouseMatch['status'];

// Admin client for the LightHouse plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/lighthouse/admin/*. Admin access is enforced
// server-side; a 401/403 surfaces as a "forbidden" notice in the screen.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
const ADMIN_API_BASE = '/api/lighthouse/admin';

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
export async function fetchAdminStats(): Promise<StatsFetchResult> {
  const res = await authedFetch(`${ADMIN_API_BASE}/stats`, {
    headers: { 'Content-Type': 'application/json' },
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
export async function fetchAdminMatches(): Promise<MatchesFetchResult> {
  const res = await authedFetch(`${ADMIN_API_BASE}/matches`, {
    headers: { 'Content-Type': 'application/json' },
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
  matchId: string,
  status: LighthouseMatchStatus,
): Promise<LighthouseMatch> {
  const res = await authedFetch(`${ADMIN_API_BASE}/matches/${matchId}`, {
    method: 'PUT',
    headers: {
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
