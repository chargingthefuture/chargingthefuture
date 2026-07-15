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
  LighthouseProfile,
  SeekerProfileInput,
  MatchCreateInput,
} from './types';

const API_BASE = '/api/lighthouse';

// Result of a mutation the caller branches on by server code — e.g. `policy_denied` routes a member
// with no active seeker profile to the setup screen, `duplicate_match` is a friendly notice. `code`
// and `message` are set on failure (`ok: false`).
export type LighthouseMutationResult = { ok: boolean; code?: string; message?: string };

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

// GET /api/lighthouse/profile → the member's own preference profile, or null when they have none
// yet (the route answers 404). A first-time seeker starts from the empty form.
export async function fetchProfile(): Promise<LighthouseProfile | null> {
  const res = await authedFetch(`${API_BASE}/profile`);
  if (res.status === 404) return null;
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; profile?: LighthouseProfile };
  if (!res.ok || !body.ok || !body.profile) {
    throw new Error('Could not load your details. Please try again.');
  }
  return body.profile;
}

// POST /api/lighthouse/profile — upsert the seeker profile. A host trying to save a seeker profile
// is denied server-side (`policy_denied`) because the profile type is locked.
export async function upsertSeekerProfile(input: SeekerProfileInput): Promise<LighthouseMutationResult> {
  const res = await authedFetch(`${API_BASE}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; message?: string };
  if (res.ok && body.ok) return { ok: true };
  return { ok: false, code: body.code ?? 'error', message: body.message ?? 'Could not save your details. Please try again.' };
}

// POST /api/lighthouse/matches — create a match request ("Request to stay"). Returns `policy_denied`
// when the member has no active seeker profile, and `duplicate_match` when a request already exists.
export async function createMatchRequest(input: MatchCreateInput): Promise<LighthouseMutationResult> {
  const res = await authedFetch(`${API_BASE}/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; message?: string };
  if (res.ok && body.ok) return { ok: true };
  return { ok: false, code: body.code ?? 'error', message: body.message ?? 'Could not send your request. Please try again.' };
}
