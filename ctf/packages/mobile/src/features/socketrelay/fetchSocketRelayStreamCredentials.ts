// Resolves Stream chat credentials for the signed-in user's active SocketRelay
// fulfillment. The web route is POST /api/socketrelay/fulfillments/:id/chat and
// needs a real fulfillment id, so this first reads GET /api/socketrelay/my-fulfillments
// and picks the active one — the old hardcoded "active" path segment always 404'd.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetch, authedFetchJson } from '../../auth/authedFetch';

export type SocketRelayStreamCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

type MyFulfillment = {
  id: string;
  status: 'active' | 'closed' | 'cancelled';
};

export async function fetchSocketRelayStreamCredentials(): Promise<SocketRelayStreamCredentials> {
  const mine = await authedFetchJson<{ ok: boolean; items?: MyFulfillment[] }>(
    '/api/socketrelay/my-fulfillments',
  );
  const active = (mine.items ?? []).find((item) => item.status === 'active');
  if (!active) {
    throw new Error('No active fulfillment — chat opens once a request is being fulfilled.');
  }

  const res = await authedFetch(`/api/socketrelay/fulfillments/${active.id}/chat`, {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data?.message || 'Unable to load SocketRelay chat credentials');
  }
  return {
    streamApiKey: data.streamApiKey,
    streamToken: data.streamToken,
    streamUserId: data.streamUserId,
    streamChannelId: data.streamChannelId,
  };
}
