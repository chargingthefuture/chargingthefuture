import { Platform } from 'react-native';
import type { TrustTransportRequest, TrustTransportRequestInput, TrustTransportOffer, TrustTransportTrip, TrustTransportMode } from './types';

export const API_BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3000/api/trusttransport'
  : 'http://localhost:3000/api/trusttransport';

const MUTATION_HEADERS = {
  'Content-Type': 'application/json',
  'x-ctf-csrf': '1',
};

export interface ListRequestsResponse {
  ok: boolean;
  items: TrustTransportRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listModes(): Promise<TrustTransportMode[]> {
  const res = await fetch(`${API_BASE_URL}/modes`);
  if (!res.ok) throw new Error('Failed to fetch modes');
  const data = await res.json() as { ok: boolean; modes: TrustTransportMode[] };
  return data.modes ?? [];
}

export async function listRequests(page = 1): Promise<ListRequestsResponse> {
  const res = await fetch(`${API_BASE_URL}/requests?page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch requests');
  return res.json() as Promise<ListRequestsResponse>;
}

export async function createRequest(
  input: TrustTransportRequestInput,
  idempotencyKey: string,
): Promise<TrustTransportRequest> {
  const res = await fetch(`${API_BASE_URL}/requests`, {
    method: 'POST',
    headers: MUTATION_HEADERS,
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
  if (!res.ok) throw new Error('Failed to create request');
  const data = await res.json() as { ok: boolean; item: TrustTransportRequest };
  return data.item;
}

export async function listOffersForRequest(requestId: string): Promise<TrustTransportOffer[]> {
  const res = await fetch(`${API_BASE_URL}/requests/${requestId}/offers`);
  if (!res.ok) throw new Error('Failed to fetch offers');
  const data = await res.json() as { ok: boolean; items: TrustTransportOffer[] };
  return data.items ?? [];
}

export async function acceptOffer(offerId: string): Promise<TrustTransportTrip> {
  const res = await fetch(`${API_BASE_URL}/offers/${offerId}/accept`, {
    method: 'POST',
    headers: MUTATION_HEADERS,
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to accept offer');
  const data = await res.json() as { ok: boolean; item: TrustTransportTrip };
  return data.item;
}
