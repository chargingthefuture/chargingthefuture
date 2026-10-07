import { isDemoMode } from 'lib/feature-flags';

export type StreamCredentials = {
  apiKey: string;
  apiSecret: string;
};

// Resolves the active Stream (GetStream) API credentials for the current request.
//
// Demo mode routes to a dedicated demo Stream app (STREAM_API_KEY_STAGING /
// STREAM_API_SECRET_STAGING) so recording sessions never consume the production
// Maker-tier quota (see 110-stream-maker-tier-rules.mdc). When demo mode is on we
// never fall back to the production app: if the demo credentials are absent the
// caller receives null and the Stream-backed feature degrades, which is the
// intended safe outcome rather than silently billing production quota.
export async function resolveStreamCredentials(): Promise<StreamCredentials | null> {
  const demo = await isDemoMode();
  const apiKey = (demo ? process.env.STREAM_API_KEY_STAGING : process.env.STREAM_API_KEY)?.trim();
  const apiSecret = (demo ? process.env.STREAM_API_SECRET_STAGING : process.env.STREAM_API_SECRET)?.trim();

  if (!apiKey || !apiSecret) {
    return null;
  }

  return { apiKey, apiSecret };
}

// The two Stream apps this project runs: production, and the demo app demo mode routes to.
export type StreamAppName = 'production' | 'staging';

// Credentials for a named Stream app, whatever the request's demo mode. For a caller that already
// knows which app it is talking to, such as a webhook delivery, which carries no signed-in user and
// so cannot tell demo mode from the request. Null when that app's credentials are absent.
export function streamCredentialsFor(app: StreamAppName): StreamCredentials | null {
  const staging = app === 'staging';
  const apiKey = (staging ? process.env.STREAM_API_KEY_STAGING : process.env.STREAM_API_KEY)?.trim();
  const apiSecret = (staging ? process.env.STREAM_API_SECRET_STAGING : process.env.STREAM_API_SECRET)?.trim();
  if (!apiKey || !apiSecret) {
    return null;
  }
  return { apiKey, apiSecret };
}
