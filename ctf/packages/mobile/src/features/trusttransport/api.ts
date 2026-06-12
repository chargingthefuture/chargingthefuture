// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetchJson } from '../../auth/authedFetch';
import type { TrustTransportRequest, TrustTransportRequestInput, TrustTransportOffer, TrustTransportTrip, TrustTransportMode } from './types';

const BASE = '/api/trusttransport';

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
  const data = await authedFetchJson<{ ok: boolean; modes: TrustTransportMode[] }>(`${BASE}/modes`);
  return data.modes ?? [];
}

export async function listRequests(page = 1): Promise<ListRequestsResponse> {
  return authedFetchJson<ListRequestsResponse>(`${BASE}/requests?page=${page}`);
}

export async function createRequest(
  input: TrustTransportRequestInput,
  idempotencyKey: string,
): Promise<TrustTransportRequest> {
  const data = await authedFetchJson<{ ok: boolean; item: TrustTransportRequest }>(`${BASE}/requests`, {
    method: 'POST',
    headers: MUTATION_HEADERS,
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
  return data.item;
}

export async function listOffersForRequest(requestId: string): Promise<TrustTransportOffer[]> {
  const data = await authedFetchJson<{ ok: boolean; items: TrustTransportOffer[] }>(
    `${BASE}/requests/${requestId}/offers`,
  );
  return data.items ?? [];
}

export async function acceptOffer(offerId: string): Promise<TrustTransportTrip> {
  const data = await authedFetchJson<{ ok: boolean; item: TrustTransportTrip }>(
    `${BASE}/offers/${offerId}/accept`,
    {
      method: 'POST',
      headers: MUTATION_HEADERS,
      body: JSON.stringify({}),
    },
  );
  return data.item;
}
