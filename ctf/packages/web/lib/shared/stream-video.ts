// Stream Video singleton client for web
import { StreamVideoClient } from '@stream-io/video-react-sdk';

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
    // Clean up previous client if credentials changed
    if (streamVideoClient) {
      try {
        streamVideoClient.disconnectUser?.();
      } catch {
        /* no-trace: the client is already disconnected */
      }
      streamVideoClient = null;
    }
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
