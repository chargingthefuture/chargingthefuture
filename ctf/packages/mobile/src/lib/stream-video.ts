// Stream Video singleton client for React Native (mobile)
import { StreamVideoClient } from '@stream-io/video-react-native-sdk';

let streamVideoClient: StreamVideoClient | null = null;

export function getStreamVideoClient(apiKey: string, token: string, userId: string) {
  if (!streamVideoClient) {
    streamVideoClient = new StreamVideoClient({
      apiKey,
      user: { id: userId },
      token,
    });
  }
  return streamVideoClient;
}
