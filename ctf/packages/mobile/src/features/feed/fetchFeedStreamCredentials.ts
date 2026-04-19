// Fetches Stream credentials for the Feed feature (mobile)
import { Platform } from 'react-native';

export type FeedStreamCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

export async function fetchFeedStreamCredentials(): Promise<FeedStreamCredentials> {
  // Use the correct base URL for Expo/React Native fetch
  const baseUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/feed/stream`, { method: 'POST' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Unable to load feed stream credentials');
  return {
    streamApiKey: data.streamApiKey,
    streamToken: data.streamToken,
    streamUserId: data.streamUserId,
    streamChannelId: data.streamChannelId,
  };
}
