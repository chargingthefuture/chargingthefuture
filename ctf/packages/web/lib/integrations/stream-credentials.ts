import { getForcedPoolTarget } from 'lib/db/postgres';
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
//
// A schema pinned with runWithForcedPool wins over demo-mode targeting, the same as it does for the
// database pool. Demo mode targets the signed-in caller, and the operator account-delete route has
// none, so without this a deletion pinned to the demo schema ran its Stream cleanup against the
// production app: it hard-deleted the person's production Stream users and messages and left the
// demo copy it was meant to clear.
export async function resolveStreamCredentials(): Promise<StreamCredentials | null> {
  const forced = getForcedPoolTarget();
  const demo = forced ? forced === 'demo' : await isDemoMode();
  const apiKey = (demo ? process.env.STREAM_API_KEY_STAGING : process.env.STREAM_API_KEY)?.trim();
  const apiSecret = (demo ? process.env.STREAM_API_SECRET_STAGING : process.env.STREAM_API_SECRET)?.trim();

  if (!apiKey || !apiSecret) {
    return null;
  }

  return { apiKey, apiSecret };
}
