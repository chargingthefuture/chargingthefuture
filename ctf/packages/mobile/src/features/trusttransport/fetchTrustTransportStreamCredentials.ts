// Stream chat credentials for a trip thread. The web route is
// POST /api/trusttransport/trips/[tripId]/chat; it returns
// { ok, channelId, streamApiKey, streamUserId, streamToken }, mapped here to the
// shape the Stream client components consume. Goes through authedFetch so the
// Clerk bearer token is attached and the base URL comes from runtime config.
import { Platform } from 'react-native';
import { authedFetchJson } from '../../auth/authedFetch';

export interface TrustTransportStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  callId?: string;
  chatChannelId?: string;
}

type TripChatResponse = {
  ok: boolean;
  channelId: string;
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
  return {
    apiKey: data.streamApiKey,
    userId: data.streamUserId,
    userToken: data.streamToken,
    chatChannelId: data.channelId,
    // The chat route issues no video call id; video remains unsupported until a
    // backing route exists.
  };
}
