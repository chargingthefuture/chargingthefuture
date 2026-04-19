import { Platform } from 'react-native';

export interface TrustTransportStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  callId?: string;
  chatChannelId?: string;
}

export async function fetchTrustTransportStreamCredentials(tripId: string): Promise<TrustTransportStreamCredentials> {
  const res = await fetch(`/api/trusttransport/trips/${tripId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ platform: Platform.OS }),
  });
  if (!res.ok) throw new Error('Failed to fetch Stream credentials');
  return res.json();
}
