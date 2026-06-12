import { Platform } from 'react-native';

export interface QuestionsStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  chatChannelId: string;
}

// Fetches Stream chat credentials for the Feed "Questions" channel. React Native fetch has no page
// origin, so a relative '/api/...' path never resolves — use the platform base URL (Android emulator
// reaches the host at 10.0.2.2). The server returns the canonical stream* field names; map them to the
// shape the Questions screen reads.
export async function fetchQuestionsStreamCredentials(): Promise<QuestionsStreamCredentials> {
  const baseUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/questions/stream`, { method: 'POST' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = await res.json();
  } catch {
    const text = await res.text();
    throw new Error(`Unable to parse response as JSON (status ${res.status}): ${text}`);
  }
  if (!data || !data.ok) {
    throw new Error((data && data.message) || `Unable to load Questions chat credentials (status ${res.status})`);
  }
  return {
    apiKey: data.streamApiKey,
    userId: data.streamUserId,
    userToken: data.streamToken,
    chatChannelId: data.streamChannelId,
  };
}
