// Stream chat credentials for a trip thread. A trip is text chat only — there is no video.
// The web route is POST /api/trusttransport/trips/[tripId]/chat; it returns
// { ok, streamChannelId, streamApiKey, streamUserId, streamToken }, mapped here to the
// shape the Stream client components consume. Goes through authedFetch so the
// Clerk bearer token is attached and the base URL comes from runtime config.
import { Platform } from 'react-native';
import { authedFetchJson } from '../../auth/authedFetch';

export interface TrustTransportStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  chatChannelId: string;
}

type TripChatResponse = {
  ok: boolean;
  message?: string;
  streamChannelId?: string;
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

export async function fetchTrustTransportStreamCredentials(tripId: string): Promise<TrustTransportStreamCredentials> {
  const data = await authedFetchJson<TripChatResponse>(`/api/trusttransport/trips/${tripId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ platform: Platform.OS }),
  });
  if (!data.ok) {
    throw new Error(data.message || 'Unable to load TrustTransport chat credentials');
  }
  const chatChannelId = data.streamChannelId;
  if (!chatChannelId) {
    throw new Error('TrustTransport chat credentials response is missing the channel id');
  }
  return {
    apiKey: data.streamApiKey,
    userId: data.streamUserId,
    userToken: data.streamToken,
    chatChannelId,
  };
}
