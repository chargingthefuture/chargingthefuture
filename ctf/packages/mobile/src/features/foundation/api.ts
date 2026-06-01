import { Platform } from 'react-native';

const API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/foundation'
    : 'http://localhost:3000/api/foundation';

const CSRF_HEADER = { 'x-ctf-csrf': '1' };
const JSON_HEADERS = { 'Content-Type': 'application/json', ...CSRF_HEADER };

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
  const res = await fetch(`${API_BASE}/providers/search?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch providers');
  return res.json() as Promise<ProvidersSearchResult>;
}

export async function fetchQuoteHistory(): Promise<QuoteHistoryResult> {
  const res = await fetch(`${API_BASE}/quotes/history`);
  if (!res.ok) throw new Error('Failed to fetch quote history');
  return res.json() as Promise<QuoteHistoryResult>;
}

export async function createConnectionThread(providerId: string): Promise<{ threadId: string; ok: boolean }> {
  const res = await fetch(`${API_BASE}/connections/threads`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ providerId }),
  });
  if (!res.ok) throw new Error('Failed to create connection thread');
  return res.json() as Promise<{ threadId: string; ok: boolean }>;
}

export async function requestQuote(threadId: string, serviceType = 'general'): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/quotes`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ threadId, serviceType }),
  });
  if (!res.ok) throw new Error('Failed to request quote');
  return res.json() as Promise<{ ok: boolean }>;
}
