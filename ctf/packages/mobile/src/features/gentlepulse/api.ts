// GentlePulse API service for mobile — binds to real backend routes only.
// CSRF header (x-ctf-csrf: 1) is required by the web routes for all mutations.

import { Platform } from 'react-native';

const API_BASE =
  Platform.OS === 'web'
    ? '/api/gentlepulse'
    : process.env.EXPO_PUBLIC_API_BASE
      ? `${process.env.EXPO_PUBLIC_API_BASE}/api/gentlepulse`
      : 'https://api.chargingthefuture.com/api/gentlepulse';

// Shape returned by GET /api/gentlepulse/library → { ok, items }
export interface GentlePulseSession {
  id: string;
  slug: string;
  title: string;
  description: string;
  mediaUrl: string;
  supportRoute: string;
}

export async function fetchSessions(): Promise<GentlePulseSession[]> {
  const res = await fetch(`${API_BASE}/library`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  const data = await res.json();
  return (data.items ?? []) as GentlePulseSession[];
}

// POST /api/gentlepulse/library/:itemId/play — requires CSRF header
export async function recordPlay(itemId: string, completed = false): Promise<void> {
  const res = await fetch(`${API_BASE}/library/${encodeURIComponent(itemId)}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new Error('Failed to record play event');
}

// POST /api/gentlepulse/library/:itemId/favorite — requires CSRF header
export async function addFavorite(itemId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/library/${encodeURIComponent(itemId)}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
  });
  if (!res.ok) throw new Error('Failed to add favorite');
}

// DELETE /api/gentlepulse/library/:itemId/favorite — requires CSRF header
export async function removeFavorite(itemId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/library/${encodeURIComponent(itemId)}/favorite`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
  });
  if (!res.ok) throw new Error('Failed to remove favorite');
}
