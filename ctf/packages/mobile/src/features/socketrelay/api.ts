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

export type SocketRelayRequestInput = {
  title: string;
  details: string;
  category: string;
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
