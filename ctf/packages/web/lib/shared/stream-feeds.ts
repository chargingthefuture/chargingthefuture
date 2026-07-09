// Stream Feeds singleton client for web
import { StreamClient } from 'getstream';

let streamFeedsClient: StreamClient | null = null;
let streamFeedsApiKey: string | null = null;
let streamFeedsToken: string | null = null;
let streamFeedsAppId: string | null = null;

export function getStreamFeedsClient(apiKey: string, token: string, appId: string) {
  if (
    !streamFeedsClient ||
    streamFeedsApiKey !== apiKey ||
    streamFeedsToken !== token ||
    streamFeedsAppId !== appId
  ) {
    // Drop the previous client if credentials changed so a new user does not
    // reuse a client authenticated as the previous user.
    streamFeedsClient = new StreamClient(apiKey, token, appId);
    streamFeedsApiKey = apiKey;
    streamFeedsToken = token;
    streamFeedsAppId = appId;
  }
  return streamFeedsClient;
}
