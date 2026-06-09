// Load a local .env when dotenv is available (handy for local runs). In CI the
// values come from the workflow's env block, so a missing dotenv is fine.
try {
  await import('dotenv/config');
} catch {
  // dotenv is optional; ignore when it is not installed.
}

// Mobile env contract check.
//
// The mobile app reads the SAME environment names as the web app and ships to a
// SINGLE production environment (demo/staging data is a runtime Unleash flag, not
// a deploy environment). It requires:
//   - NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY   Clerk publishable key (real sign-in)
//   - NEXT_PUBLIC_APP_URL                https API base URL (the deployed host)
//   - EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID  Clerk OAuth client id (native sign-in)
//   - EXPO_MOBILE_PROJECT_ID             EAS project id
//   - EXPO_MOBILE_UPDATES_URL            EAS updates URL
//
// There is NO per-user identity to configure: the user signs in with Clerk at
// runtime and API calls carry a verified bearer token. Profile is informational
// only (preview and production both point at the same production config).

const profile = process.env.MOBILE_ENV_TARGET || process.env.EAS_BUILD_PROFILE || 'preview';

function requireVar(key) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exitCode = 1;
  }
}

function parseUrl(value) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

requireVar('NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY');
requireVar('NEXT_PUBLIC_APP_URL');
requireVar('EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID');
requireVar('EXPO_MOBILE_PROJECT_ID');
requireVar('EXPO_MOBILE_UPDATES_URL');

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const parsedAppUrl = parseUrl(appUrl);

if (!parsedAppUrl) {
  console.error(`Invalid NEXT_PUBLIC_APP_URL format: ${appUrl}`);
  process.exitCode = 1;
} else {
  if (parsedAppUrl.protocol !== 'https:') {
    console.error(`NEXT_PUBLIC_APP_URL must use https. Received: ${appUrl}`);
    process.exitCode = 1;
  }

  const appHost = parsedAppUrl.hostname.toLowerCase();
  if (appHost === 'localhost' || appHost === '127.0.0.1') {
    console.error(`NEXT_PUBLIC_APP_URL cannot use localhost for cloud mobile builds. Received host: ${parsedAppUrl.hostname}`);
    process.exitCode = 1;
  }
}

const updatesUrl = process.env.EXPO_MOBILE_UPDATES_URL;
const parsedUpdatesUrl = parseUrl(updatesUrl);
if (updatesUrl && !parsedUpdatesUrl) {
  console.error(`Invalid EXPO_MOBILE_UPDATES_URL format: ${updatesUrl}`);
  process.exitCode = 1;
}

if (process.exitCode && process.exitCode !== 0) {
  console.error(`Mobile env validation failed for profile: ${profile}`);
  process.exit(process.exitCode);
}

console.log(`Mobile env validation passed for profile: ${profile}`);
