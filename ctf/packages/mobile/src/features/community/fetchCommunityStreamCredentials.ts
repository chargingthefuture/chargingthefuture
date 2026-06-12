// Stream chat credentials for the community/feed channel. The web route is
// POST /api/feed/stream (there is no /api/community/stream route); it returns
// streamApiKey/streamToken/streamUserId/streamChannelId, mapped here to the
// shape the Stream client components consume. Goes through authedFetch so the
// Clerk bearer token is attached and the base URL comes from runtime config.
import { authedFetchJson } from '../../auth/authedFetch';

export interface CommunityStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  chatChannelId: string;
}

type FeedStreamResponse = {
  ok: boolean;
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

export async function fetchCommunityStreamCredentials(): Promise<CommunityStreamCredentials> {
  const data = await authedFetchJson<FeedStreamResponse>('/api/feed/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
  });
  return {
    apiKey: data.streamApiKey,
    userId: data.streamUserId,
    userToken: data.streamToken,
    chatChannelId: data.streamChannelId,
  };
}
