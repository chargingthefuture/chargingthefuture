// GentlePulse API service for mobile — binds to real backend routes only.
// CSRF header (x-ctf-csrf: 1) is required by the web routes for all mutations.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).

import { authedFetch } from '../../auth/authedFetch';

const API_BASE = '/api/gentle-pulse';

// Shape returned by GET /api/gentle-pulse/library → { ok, items }
export interface GentlePulseSession {
  id: string;
  slug: string;
  title: string;
  description: string;
  mediaUrl: string;
  supportRoute: string;
}

export async function fetchSessions(): Promise<GentlePulseSession[]> {
  const res = await authedFetch(`${API_BASE}/library`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  const data = await res.json();
  return (data.items ?? []) as GentlePulseSession[];
}

// POST /api/gentle-pulse/library/:itemId/play — requires CSRF header
export async function recordPlay(itemId: string, completed = false): Promise<void> {
  const res = await authedFetch(`${API_BASE}/library/${encodeURIComponent(itemId)}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new Error('Failed to record play event');
}

// POST /api/gentle-pulse/library/:itemId/favorite — requires CSRF header
export async function addFavorite(itemId: string): Promise<void> {
  const res = await authedFetch(`${API_BASE}/library/${encodeURIComponent(itemId)}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
  });
  if (!res.ok) throw new Error('Failed to add favorite');
}

// DELETE /api/gentle-pulse/library/:itemId/favorite — requires CSRF header
export async function removeFavorite(itemId: string): Promise<void> {
  const res = await authedFetch(`${API_BASE}/library/${encodeURIComponent(itemId)}/favorite`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
  });
  if (!res.ok) throw new Error('Failed to remove favorite');
}
