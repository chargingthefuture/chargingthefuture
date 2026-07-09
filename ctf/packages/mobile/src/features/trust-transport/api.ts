// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetchJson } from '../../auth/authedFetch';
import type {
  TrustTransportRequest,
  TrustTransportRequestInput,
  TrustTransportOffer,
  TrustTransportOfferInput,
  TrustTransportTrip,
  TrustTransportMode,
  TrustTransportAvailableRequest,
  TrustTransportProviderTrip,
  TrustTransportPayoutRequest,
  TrustTransportEarningsBalance,
  TrustTransportTripStatus,
} from './types';

const BASE = '/api/trust-transport';

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

// Cancel your own request (any non-terminal status). Confirmed by the caller before invoking.
export async function cancelOrder(requestId: string): Promise<void> {
  await authedFetchJson<{ ok: boolean }>(`${BASE}/orders/${requestId}/cancel`, {
    method: 'POST',
    headers: MUTATION_HEADERS,
    body: JSON.stringify({}),
  });
}

export async function listOffersForRequest(requestId: string): Promise<TrustTransportOffer[]> {
  const data = await authedFetchJson<{ ok: boolean; items: TrustTransportOffer[] }>(
    `${BASE}/requests/${requestId}/offers`,
  );
  return data.items ?? [];
}

// Accept an offer on your own request. The route requires the requestId in the body and returns the
// opened trip as `trip` (the previous implementation sent an empty body and read the wrong field).
export async function acceptOffer(requestId: string, offerId: string): Promise<TrustTransportTrip> {
  const data = await authedFetchJson<{ ok: boolean; trip: TrustTransportTrip }>(
    `${BASE}/offers/${offerId}/accept`,
    {
      method: 'POST',
      headers: MUTATION_HEADERS,
      body: JSON.stringify({ requestId }),
    },
  );
  return data.trip;
}

// Discovery model B: open requests you can offer to help with — mode + settlement + age only.
export async function listAvailableRequests(page = 1): Promise<TrustTransportAvailableRequest[]> {
  const data = await authedFetchJson<{ ok: boolean; items: TrustTransportAvailableRequest[] }>(
    `${BASE}/requests/available?page=${page}`,
  );
  return data.items ?? [];
}

// Make (or update) your offer on an open request. One pending offer per provider per request.
export async function createOffer(requestId: string, input: TrustTransportOfferInput): Promise<TrustTransportOffer> {
  const data = await authedFetchJson<{ ok: boolean; offer: TrustTransportOffer }>(
    `${BASE}/requests/${requestId}/offers`,
    {
      method: 'POST',
      headers: MUTATION_HEADERS,
      body: JSON.stringify(input),
    },
  );
  return data.offer;
}

// Trips you are fulfilling (provider side), with the now-revealed pickup/drop-off.
export async function listProviderTrips(): Promise<TrustTransportProviderTrip[]> {
  const data = await authedFetchJson<{ ok: boolean; items: TrustTransportProviderTrip[] }>(`${BASE}/trips`);
  return data.items ?? [];
}

// Advance a trip one step (forward-only, enforced server-side).
export async function updateTripStatus(tripId: string, nextStatus: TrustTransportTripStatus, note: string | null = null): Promise<TrustTransportTrip> {
  const data = await authedFetchJson<{ ok: boolean; trip: TrustTransportTrip }>(
    `${BASE}/trips/${tripId}/status`,
    {
      method: 'POST',
      headers: MUTATION_HEADERS,
      body: JSON.stringify({ nextStatus, note }),
    },
  );
  return data.trip;
}

// Confirm your side of trip completion (only valid once the trip is 'delivered'). Neither party can
// complete a trip alone — this only actually completes it (and fires settlement) once both the
// requester and the provider have confirmed.
export async function confirmTripCompletion(tripId: string): Promise<{ trip: TrustTransportTrip; bothConfirmed: boolean }> {
  const data = await authedFetchJson<{ ok: boolean; trip: TrustTransportTrip; bothConfirmed: boolean }>(
    `${BASE}/trips/${tripId}/complete`,
    {
      method: 'POST',
      headers: MUTATION_HEADERS,
      body: JSON.stringify({}),
    },
  );
  return { trip: data.trip, bothConfirmed: data.bothConfirmed };
}

// Capture pickup/delivery proof as a redacted reference (no raw images).
export async function captureProof(tripId: string, artifactType: 'photo' | 'code' | 'note', artifactRedacted: string): Promise<void> {
  await authedFetchJson<{ ok: boolean }>(`${BASE}/trips/${tripId}/proof`, {
    method: 'POST',
    headers: MUTATION_HEADERS,
    body: JSON.stringify({ artifactType, artifactRedacted }),
  });
}

// Your available earnings balance per currency (only currencies with a nonzero balance).
export async function getEarningsBalances(): Promise<TrustTransportEarningsBalance[]> {
  const data = await authedFetchJson<{ ok: boolean; balances: TrustTransportEarningsBalance[] }>(`${BASE}/earnings`);
  return data.balances ?? [];
}

export async function listPayouts(): Promise<TrustTransportPayoutRequest[]> {
  const data = await authedFetchJson<{ ok: boolean; items: TrustTransportPayoutRequest[] }>(`${BASE}/payouts`);
  return data.items ?? [];
}

// Request a payout against a specific currency's balance.
export async function requestPayout(amount: number, currency: string): Promise<TrustTransportPayoutRequest> {
  const data = await authedFetchJson<{ ok: boolean; payout: TrustTransportPayoutRequest }>(
    `${BASE}/payouts/requests`,
    {
      method: 'POST',
      headers: MUTATION_HEADERS,
      body: JSON.stringify({ amount, currency }),
    },
  );
  return data.payout;
}
