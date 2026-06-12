// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL) — same pattern as socketrelay/currency.
import { authedFetchJson } from '../../auth/authedFetch';

const BASE = '/api/foundation';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

export interface Provider {
  profileId: string;
  providerUserId: string;
  displayName: string;
  headline?: string;
  bio?: string;
  // score is internal — not rendered
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

export async function fetchProviders(query = '', page = 1): Promise<ProvidersSearchResult> {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set('q', query);
  return authedFetchJson<ProvidersSearchResult>(`${BASE}/providers/search?${params.toString()}`);
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
