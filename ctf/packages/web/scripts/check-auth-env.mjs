import { getEnvValue } from '../lib/auth/env-utils.mjs';

const publishableKey = getEnvValue('NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
const secretKey = getEnvValue('AUTH_SECRET_KEY', 'CLERK_SECRET_KEY');

if (!publishableKey && !secretKey) {
  console.log('No auth provider environment is configured. Skipping auth env validation.');
  process.exit(0);
}

let failed = false;

function requireAny(label, keys) {
  const value = getEnvValue(...keys);
  if (value) {
    return value;
  }

  console.error(`Missing required auth env: ${label} (${keys.join(' or ')})`);
  failed = true;
  return undefined;
}

function parseUrl(value, label) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    console.error(`Invalid ${label}: ${value}`);
    failed = true;
    return null;
  }
}

const appUrl = requireAny('NEXT_PUBLIC_APP_URL', ['NEXT_PUBLIC_APP_URL']);
requireAny(
  'NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  ['NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
);
requireAny('AUTH_SECRET_KEY or CLERK_SECRET_KEY', ['AUTH_SECRET_KEY', 'CLERK_SECRET_KEY']);

const signInUrl = getEnvValue('NEXT_PUBLIC_AUTH_SIGN_IN_URL', 'NEXT_PUBLIC_CLERK_SIGN_IN_URL');
if (signInUrl) {
  const parsedApp = parseUrl(appUrl, 'NEXT_PUBLIC_APP_URL');
  const parsedSignIn = parseUrl(signInUrl, 'NEXT_PUBLIC_AUTH_SIGN_IN_URL or NEXT_PUBLIC_CLERK_SIGN_IN_URL');
  if (parsedApp && parsedSignIn && parsedSignIn.protocol !== parsedApp.protocol) {
    console.error(
      `Sign-in URL protocol mismatch. signIn=${parsedSignIn.protocol} app=${parsedApp.protocol}.`,
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('Auth environment validation passed.');
