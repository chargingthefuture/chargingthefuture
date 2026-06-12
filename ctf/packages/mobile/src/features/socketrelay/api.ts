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
};

// Poster handle: show the chosen @username (owner decision: shown publicly, never "Anonymous").
// When no username was captured, fall back to a neutral short id — mirrors Chyme's chymeHandle.
export function socketRelayHandle(
  username: string | null,
  id: string,
): string {
  return username ? `@${username}` : `user-${id.slice(0, 8)}`;
}

export type ListRequestsResponse = {
  ok: boolean;
  items: SocketRelayRequest[];
  page: number;
  pageSize: number;
  total: number;
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
