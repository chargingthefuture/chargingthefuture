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
