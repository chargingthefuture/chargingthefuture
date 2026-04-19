// Stream Feeds singleton client for web
import { StreamClient } from 'getstream';

let streamFeedsClient: StreamClient | null = null;

export function getStreamFeedsClient(apiKey: string, token: string, appId: string) {
  if (!streamFeedsClient) {
    streamFeedsClient = new StreamClient(apiKey, token, appId);
  }
  return streamFeedsClient;
}
