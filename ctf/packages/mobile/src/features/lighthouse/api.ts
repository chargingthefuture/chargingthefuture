// LightHouse mobile API client. Mirrors the web routes under
// ctf/packages/web/app/api/lighthouse/*. All calls go through authedFetchJson so
// the Clerk bearer token is attached and the base URL comes from runtime config
// (APP_URL).
import { authedFetch, authedFetchJson } from '../../auth/authedFetch';
import type {
  PropertiesResponse,
  MatchesResponse,
  MyPropertiesResponse,
  PropertyCreateInput,
} from './types';

const API_BASE = '/api/lighthouse';

export async function fetchProperties(page = 1, pageSize = 20): Promise<PropertiesResponse> {
  return authedFetchJson<PropertiesResponse>(
    `${API_BASE}/properties?page=${page}&pageSize=${pageSize}&onlyActive=true`,
  );
}

export async function fetchMatches(): Promise<MatchesResponse> {
  return authedFetchJson<MatchesResponse>(`${API_BASE}/matches`);
}

// GET /api/lighthouse/my-properties → { ok, items, host: { quoraProfileUrl } }
// The host's own listings plus the composed-identity Quora link.
export async function fetchMyProperties(): Promise<MyPropertiesResponse> {
  return authedFetchJson<MyPropertiesResponse>(`${API_BASE}/my-properties`);
}

// POST /api/lighthouse/properties — creates a listing. Requires the x-ctf-csrf
// header the web route enforces. Returns the created property on success (201).
export async function createProperty(input: PropertyCreateInput): Promise<void> {
  const res = await authedFetch(`${API_BASE}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
  if (!res.ok || !body.ok) {
    throw new Error(body.message ?? 'Could not create the listing. Please try again.');
  }
}
