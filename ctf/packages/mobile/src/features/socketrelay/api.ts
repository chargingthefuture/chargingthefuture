// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL) — same pattern as chyme/currency.
import { authedFetch, authedFetchJson } from '../../auth/authedFetch';

const BASE = '/api/socketrelay';

export type SocketRelayRequestStatus = 'open' | 'claimed' | 'closed' | 'cancelled';

export type SocketRelayRequest = {
  id: string;
  ownerUserId: string;
  ownerUsername: string | null;
  title: string;
  details: string;
  category: string;
  tags: string[];
  city: string | null;
  isPublic: boolean;
  status: SocketRelayRequestStatus;
  reopenedCount: number;
  claimedFulfillmentId: string | null;
  priceCurrency: string | null;
  priceAmount: number | null;
  createdAtIso: string;
  updatedAtIso: string;
};

// `tags` carries 1-3 free-text tags; the server keeps the legacy single
// `category` in sync with the first tag for older clients.
export type SocketRelayRequestInput = {
  title: string;
  details: string;
  tags: string[];
  city: string | null;
  isPublic: boolean;
  priceCurrency: string | null;
  priceAmount: number | null;
};

// Plain label for how a request is settled (issue #420). Mirrors the web sr-shared.settlementLabel:
// honors the ServiceCredits rule (never the bare "SC" code, never a fiat equivalent) and renders
// Free/Barter from their value types; fiat/crypto show amount + code.
export function settlementLabel(priceCurrency: string | null, priceAmount: number | null): string {
  if (!priceCurrency || priceCurrency === 'FREE') return 'Free';
  if (priceCurrency === 'BARTER') return 'Barter';
  if (priceCurrency === 'SC') return priceAmount != null ? `${priceAmount} ServiceCredits` : 'ServiceCredits';
  return priceAmount != null ? `${priceAmount} ${priceCurrency}` : priceCurrency;
}

// Poster handle: show the chosen @username (owner decision: shown publicly, never "Anonymous").
// When no username was captured, fall back to a neutral short id — mirrors Chyme's chymeHandle.
export function socketRelayHandle(
  username: string | null,
  id: string,
): string {
  return username ? `@${username}` : `user-${id.slice(0, 8)}`;
}

// How the requester (the person who posted the request) resolves a claimed request. Only the
// requester (or an admin) may resolve — a helper can chat but cannot close someone else's request.
// Mirrors the web SocketRelayResolveOutcome / SrResolveOutcome union exactly.
//   successful          -> the help happened; close the request.
//   no_longer_needed     -> requester no longer needs it; close the request.
//   unsuccessful_reopen  -> it didn't work out; cancel this helper and put the request back to open.
//   unsuccessful_close   -> it didn't work out and the requester is done; close the request.
export type SocketRelayResolveOutcome =
  | 'successful'
  | 'no_longer_needed'
  | 'unsuccessful_reopen'
  | 'unsuccessful_close';

export type SocketRelayFulfillmentStatus = 'active' | 'closed' | 'cancelled';

// Mirrors the web SrFulfillment. `requestTitle`/`requestStatus` are joined from the request by
// GET /api/socketrelay/my-fulfillments so the Direct Line can show context; both are optional
// because a single-fulfillment fetch does not join the request.
export type SocketRelayFulfillment = {
  id: string;
  requestId: string;
  requesterUserId: string;
  fulfillerUserId: string;
  status: SocketRelayFulfillmentStatus;
  closeReason: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  requestTitle?: string;
  requestStatus?: SocketRelayRequestStatus;
};

export type ListRequestsResponse = {
  ok: boolean;
  items: SocketRelayRequest[];
  page: number;
  pageSize: number;
  total: number;
};

export type ListMyFulfillmentsResponse = {
  ok: boolean;
  items: SocketRelayFulfillment[];
};

export async function listRequests(
  page = 1,
  pageSize = 20,
): Promise<ListRequestsResponse> {
  return authedFetchJson<ListRequestsResponse>(
    `${BASE}/requests?page=${page}&pageSize=${pageSize}`,
  );
}

// The signed-in user's own requests. The client never learns its own user id;
// ownership is established by membership in this list.
export async function listMyRequests(): Promise<ListRequestsResponse> {
  return authedFetchJson<ListRequestsResponse>(`${BASE}/my-requests`);
}

export async function createRequest(
  input: SocketRelayRequestInput,
): Promise<SocketRelayRequest> {
  const data = await authedFetchJson<{ ok: boolean; item: SocketRelayRequest }>(
    `${BASE}/requests`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ctf-csrf': '1',
      },
      body: JSON.stringify(input),
    },
  );
  return data.item;
}

export async function updateRequest(
  requestId: string,
  input: SocketRelayRequestInput,
): Promise<SocketRelayRequest> {
  const data = await authedFetchJson<{ ok: boolean; item: SocketRelayRequest }>(
    `${BASE}/requests/${requestId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-ctf-csrf': '1',
      },
      body: JSON.stringify(input),
    },
  );
  return data.item;
}

export async function fulfillRequest(requestId: string): Promise<void> {
  const res = await authedFetch(`${BASE}/requests/${requestId}/fulfill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to fulfill request');
}

// The signed-in member's Direct Lines: every fulfillment they're part of, whether they posted the
// request (requester) or offered to help (fulfiller). The server joins requestTitle/requestStatus.
export async function listMyFulfillments(): Promise<ListMyFulfillmentsResponse> {
  return authedFetchJson<ListMyFulfillmentsResponse>(`${BASE}/my-fulfillments`);
}

// Resolve (close/reopen) a fulfillment. The server enforces that only the requester (or an admin)
// may resolve; the mobile UI only surfaces these actions to the requester. Mirrors the web
// handleResolve: POST /api/socketrelay/fulfillments/:id/close with { outcome }.
export async function resolveFulfillment(
  fulfillmentId: string,
  outcome: SocketRelayResolveOutcome,
): Promise<void> {
  const res = await authedFetch(`${BASE}/fulfillments/${fulfillmentId}/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ outcome }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Couldn't resolve this request. Please try again.");
  }
}
