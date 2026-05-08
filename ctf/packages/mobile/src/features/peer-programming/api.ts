// API client for Peer Programming plugin (mobile)

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://api.chargingthefuture.com';

export async function fetchCohorts(_authToken?: string) {
  const res = await fetch(`${API_BASE}/api/peer-programming/room`);
  if (!res.ok) throw new Error('Failed to load peer programming room');
  const data = await res.json();
  // The room endpoint returns { topic, cohort, messages, fallbackOpen }.
  // Normalise to the array shape the component expects.
  if (data.cohort) {
    return [data.cohort];
  }
  return [];
}
