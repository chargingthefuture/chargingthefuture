// Fetches Stream credentials for the Feed feature (mobile).
// Goes through authedFetch so the Clerk bearer token is attached and the base
// URL comes from runtime config (APP_URL). Mirrors POST /api/feed/stream.
import { authedFetch } from '../../auth/authedFetch';

export type FeedStreamCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

export async function fetchFeedStreamCredentials(): Promise<FeedStreamCredentials> {
  const res = await authedFetch('/api/feed/stream', {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = await res.json();
  } catch {
    // If not JSON, try to get text and throw a more descriptive error
    const text = await res.text();
    throw new Error(`Unable to parse response as JSON (status ${res.status}): ${text}`);
  }
  if (!data || !data.ok) {
    throw new Error((data && data.message) || `Unable to load feed stream credentials (status ${res.status})`);
  }
  return {
    streamApiKey: data.streamApiKey,
    streamToken: data.streamToken,
    streamUserId: data.streamUserId,
    streamChannelId: data.streamChannelId,
  };
}
