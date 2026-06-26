// Resolves Stream chat credentials for the signed-in user's accepted LightHouse
// match. The web route is POST /api/lighthouse/matches/:matchId/chat and needs a
// real match id, so this first reads GET /api/lighthouse/matches and picks the
// accepted one — the old hardcoded "active" path segment always 404'd.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetch, authedFetchJson } from '../../auth/authedFetch';
import type { MatchesResponse } from './types';

export type LighthouseStreamCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

export async function fetchLighthouseStreamCredentials(): Promise<LighthouseStreamCredentials> {
  const mine = await authedFetchJson<MatchesResponse>('/api/lighthouse/matches');
  const accepted = (mine.items ?? []).find((match) => match.status === 'accepted');
  if (!accepted) {
    throw new Error('No accepted match — chat opens once a match is accepted.');
  }

  const res = await authedFetch(`/api/lighthouse/matches/${accepted.id}/chat`, {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data?.message || 'Unable to load Lighthouse chat credentials');
  }
  // Validate every credential field before returning. A missing field (e.g. a null streamChannelId
  // from a shape mismatch in the chat route) must fail loudly here rather than silently flow into
  // StreamChatPanel and surface as an opaque Stream SDK error.
  const credentials: LighthouseStreamCredentials = {
    streamApiKey: data.streamApiKey,
    streamToken: data.streamToken,
    streamUserId: data.streamUserId,
    streamChannelId: data.streamChannelId,
  };
  const missing = (Object.keys(credentials) as Array<keyof LighthouseStreamCredentials>).filter(
    (key) => typeof credentials[key] !== 'string' || credentials[key].length === 0,
  );
  if (missing.length > 0) {
    throw new Error(`Lighthouse chat credentials incomplete: missing ${missing.join(', ')}`);
  }

  return credentials;
}
