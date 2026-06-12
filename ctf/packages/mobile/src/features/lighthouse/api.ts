// LightHouse mobile API client. Mirrors the web routes under
// ctf/packages/web/app/api/lighthouse/*. All calls go through authedFetchJson so
// the Clerk bearer token is attached and the base URL comes from runtime config
// (APP_URL).
import { authedFetchJson } from '../../auth/authedFetch';
import type { PropertiesResponse, MatchesResponse } from './types';

const API_BASE = '/api/lighthouse';

export async function fetchProperties(page = 1, pageSize = 20): Promise<PropertiesResponse> {
  return authedFetchJson<PropertiesResponse>(
    `${API_BASE}/properties?page=${page}&pageSize=${pageSize}&onlyActive=true`,
  );
}

export async function fetchMatches(): Promise<MatchesResponse> {
  return authedFetchJson<MatchesResponse>(`${API_BASE}/matches`);
}
