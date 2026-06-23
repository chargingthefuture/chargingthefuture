// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL) — same pattern as socketrelay/currency.
import { authedFetchJson } from '../../auth/authedFetch';

const BASE = '/api/foundation';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

// A skill a provider has opted to be contacted about (their own Directory skill flagged offered).
export interface OfferedSkill {
  id: string;
  name: string;
}

export interface Provider {
  profileId: string;
  providerUserId: string;
  displayName: string;
  headline?: string;
  bio?: string;
  // Skills this provider is willing to be contacted about. Always an array; empty when none.
  offeredSkills?: OfferedSkill[];
  // score is internal — not rendered
}

// One of the member's own Directory skills, with whether they currently offer it through Foundation.
export interface OfferableSkill {
  id: string;
  name: string;
  offered: boolean;
}

export interface ProvidersSearchResult {
  ok: boolean;
  items: Provider[];
  total: number;
  pagination?: { page: number; pageSize: number };
}

export interface QuoteHistoryItem {
  id: string;
  providerId?: string;
  providerName?: string;
  status: string;
  createdAt?: string;
}

export interface QuoteHistoryResult {
  items: QuoteHistoryItem[];
}

export async function fetchProviders(
  query = '',
  page = 1,
  skillId?: string | null,
): Promise<ProvidersSearchResult> {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set('q', query);
  if (skillId) params.set('skillId', skillId);
  return authedFetchJson<ProvidersSearchResult>(`${BASE}/providers/search?${params.toString()}`);
}

// The signed-in member's own Directory skills, each flagged whether they currently offer it through
// Foundation. GET /api/foundation/provider/skills.
export async function fetchOfferableSkills(): Promise<OfferableSkill[]> {
  const data = await authedFetchJson<{ ok: boolean; skills: OfferableSkill[] }>(`${BASE}/provider/skills`);
  return data.skills ?? [];
}

// Replace the member's set of offered skills with `skillIds`. PUT /api/foundation/provider/skills.
// Returns the accepted (validated) offered skill ids.
export async function setOfferedSkills(skillIds: string[]): Promise<string[]> {
  const data = await authedFetchJson<{ ok: boolean; offeredSkillIds: string[] }>(`${BASE}/provider/skills`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ skillIds }),
  });
  return data.offeredSkillIds ?? [];
}

export async function fetchQuoteHistory(): Promise<QuoteHistoryResult> {
  return authedFetchJson<QuoteHistoryResult>(`${BASE}/quotes/history`);
}

export async function createConnectionThread(providerId: string): Promise<{ threadId: string; ok: boolean }> {
  return authedFetchJson<{ threadId: string; ok: boolean }>(`${BASE}/connections/threads`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ providerId }),
  });
}

export async function requestQuote(threadId: string, serviceType = 'general'): Promise<{ ok: boolean }> {
  return authedFetchJson<{ ok: boolean }>(`${BASE}/quotes`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ threadId, serviceType }),
  });
}
