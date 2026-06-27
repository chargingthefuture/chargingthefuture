// ClickLog mobile API client. Mirrors the web routes:
//   GET    /api/click-log        → { incidents, count }
//   POST   /api/click-log        → log an incident
//   DELETE /api/click-log/:id    → delete an incident
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetch } from '../../auth/authedFetch';

async function handleResponse(res: Response, fallbackMessage: string) {
  if (!res.ok) {
    let errorMessage = fallbackMessage;
    try {
      const body = await res.json();
      if (body.error) errorMessage = body.error;
    } catch {}
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function fetchIncidents() {
  const res = await authedFetch('/api/click-log');
  return handleResponse(res, 'Failed to fetch incidents');
}

export async function logIncident(metadata: { latitude?: number; longitude?: number; notes?: string }) {
  const res = await authedFetch('/api/click-log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ metadata }),
  });
  return handleResponse(res, 'Failed to log incident');
}

export async function deleteIncident(id: string) {
  const res = await authedFetch(`/api/click-log/${id}`, {
    method: 'DELETE',
    headers: { 'x-ctf-csrf': '1' },
  });
  return handleResponse(res, 'Failed to delete incident');
}
