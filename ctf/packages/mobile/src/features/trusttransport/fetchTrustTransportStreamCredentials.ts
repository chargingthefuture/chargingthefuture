import { Platform } from 'react-native';

export interface TrustTransportStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  callId?: string;
  chatChannelId?: string;
}

// Fetches Stream chat + video credentials for a TrustTransport trip. React Native fetch has no page
// origin, so a relative '/api/...' path never resolves — use the platform base URL (Android emulator
// reaches the host at 10.0.2.2). The server returns the canonical stream* field names plus the video
// callId; map them to the shape the stream tab reads.
export async function fetchTrustTransportStreamCredentials(tripId: string): Promise<TrustTransportStreamCredentials> {
  const baseUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/trusttransport/trips/${tripId}/chat`, {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = await res.json();
  } catch {
    const text = await res.text();
    throw new Error(`Unable to parse response as JSON (status ${res.status}): ${text}`);
  }
  if (!data || !data.ok) {
    throw new Error((data && data.message) || `Unable to load TrustTransport chat credentials (status ${res.status})`);
  }
  return {
    apiKey: data.streamApiKey,
    userId: data.streamUserId,
    userToken: data.streamToken,
    callId: data.callId,
    chatChannelId: data.streamChannelId ?? data.channelId,
  };
}
