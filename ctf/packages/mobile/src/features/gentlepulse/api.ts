// GentlePulse API service for mobile
// Handles fetching sessions, play events, and favorites

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://api.chargingthefuture.com';

export async function fetchSessions() {
  const res = await fetch(`${API_BASE}/api/gentlepulse/library`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  const data = await res.json();
  return data.items || [];
}


export async function playSession(itemId: string | number) {
  const res = await fetch(`${API_BASE}/api/gentlepulse/library/${itemId}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ completed: false }),
  });
  if (!res.ok) throw new Error('Failed to record play event');
  return await res.json();
}

export async function setFavorite(itemId: string | number, favorited: boolean) {
  const res = await fetch(`${API_BASE}/api/gentlepulse/library/${itemId}/favorite`, {
    method: favorited ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
  });
  if (!res.ok) throw new Error('Failed to update favorite');
  return await res.json();
}

export async function rateSession(itemId: string | number, rating: number) {
  const res = await fetch(`${API_BASE}/api/gentlepulse/library/${itemId}/rating`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) throw new Error('Failed to rate session');
  return await res.json();
}
