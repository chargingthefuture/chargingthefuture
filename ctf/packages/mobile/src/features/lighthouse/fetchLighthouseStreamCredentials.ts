import { Platform } from 'react-native';

export type LighthouseStreamCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

export async function fetchLighthouseStreamCredentials(): Promise<LighthouseStreamCredentials> {
  const baseUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/lighthouse/matches/active/chat`, { method: 'POST' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Unable to load Lighthouse chat credentials');
  return {
    streamApiKey: data.streamApiKey,
    streamToken: data.streamToken,
    streamUserId: data.streamUserId,
    streamChannelId: data.streamChannelId,
  };
}
