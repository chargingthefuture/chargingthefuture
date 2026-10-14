// Hands the app's runtime settings to the Expo cloud build.
//
// `eas build` runs app.config.ts twice: once on the GitHub runner, and again on Expo's build
// server, which produces the APK. The second run does not see the runner's environment — the
// Infisical step only loads values into the GitHub job. The server sees only the build profile's
// `env` block in eas.json. Without this step the installed app shipped with no API address and
// no sign-in keys, so every screen failed with "APP_URL is required" and Sign in reported it was
// not configured, even though check:mobile-env passed on the runner.
//
// The workflow runs this after check:mobile-env and before `eas build`. It copies the named values
// from the job environment into the chosen profile's `env` in eas.json. The edit stays on the
// runner and is never committed. Every value here is already compiled into the APK for anyone to
// read (a publishable key, a public client id, the app's address), so none is a secret, but the
// script still never prints one.
//
// Usage: node scripts/write-eas-build-env.mjs <profile>

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The names app.config.ts reads. Keep the two lists in step.
const KEYS = [
  'APP_URL',
  'NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_AUTH_PROVIDER',
  'NEXT_PUBLIC_AUTH_SIGN_IN_URL',
  'EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID',
  'EXPO_MOBILE_PROJECT_ID',
  'EXPO_MOBILE_UPDATES_URL',
  'OBSERVABILITY_PROVIDER',
  'EXPO_SENTRY_DSN',
];

const profile = process.argv[2];
if (!profile) {
  console.error('write-eas-build-env: pass the EAS build profile name (preview or production).');
  process.exit(1);
}

const easPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'eas.json');
const eas = JSON.parse(readFileSync(easPath, 'utf8'));
const target = eas.build?.[profile];
if (!target) {
  console.error(`write-eas-build-env: eas.json has no build profile named "${profile}".`);
  process.exit(1);
}

target.env = target.env ?? {};
const written = [];
for (const key of KEYS) {
  const value = process.env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    target.env[key] = value.trim();
    written.push(key);
  }
}

writeFileSync(easPath, `${JSON.stringify(eas, null, 2)}\n`);
console.log(`write-eas-build-env: set ${written.length} value(s) on profile "${profile}": ${written.join(', ')}`);
