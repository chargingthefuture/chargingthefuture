// Stream Video singleton client for React Native (mobile)
import { StreamVideoClient } from '@stream-io/video-react-native-sdk';

let streamVideoClient: StreamVideoClient | null = null;
let streamVideoApiKey: string | null = null;
let streamVideoToken: string | null = null;
let streamVideoUserId: string | null = null;

export function getStreamVideoClient(apiKey: string, token: string, userId: string) {
  if (
    !streamVideoClient ||
    streamVideoApiKey !== apiKey ||
    streamVideoToken !== token ||
    streamVideoUserId !== userId
  ) {
    streamVideoClient = new StreamVideoClient({
      apiKey,
      user: { id: userId },
      token,
    });
    streamVideoApiKey = apiKey;
    streamVideoToken = token;
    streamVideoUserId = userId;
  }
  return streamVideoClient;
}

export function resetStreamVideoClient() {
  if (streamVideoClient) {
    streamVideoClient.disconnectUser?.();
    streamVideoClient = null;
    streamVideoApiKey = null;
    streamVideoToken = null;
    streamVideoUserId = null;
  }
}
