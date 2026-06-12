import { Platform } from 'react-native';

export const API_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/socketrelay'
    : 'http://localhost:3000/api/socketrelay';

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
  const res = await fetch(
    `${API_BASE_URL}/requests?page=${page}&pageSize=${pageSize}`,
  );
  if (!res.ok) throw new Error('Failed to fetch requests');
  return res.json() as Promise<ListRequestsResponse>;
}

export async function createRequest(
  input: SocketRelayRequestInput,
): Promise<SocketRelayRequest> {
  const res = await fetch(`${API_BASE_URL}/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create request');
  const data = (await res.json()) as { ok: boolean; item: SocketRelayRequest };
  return data.item;
}

export async function fulfillRequest(requestId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/requests/${requestId}/fulfill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to fulfill request');
}
