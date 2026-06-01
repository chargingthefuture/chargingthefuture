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
  // A relative `/sign-in` value, or an absolute URL on the app's own host, is
  // loop-prone: the in-app `/sign-in` page only forwards to the sign-in URL, so
  // pointing it back at itself produces ERR_TOO_MANY_REDIRECTS. Sign-in must be
  // hosted on Clerk's Account Portal (a different host, e.g.
  // https://accounts.<domain>/sign-in). The app self-corrects by deriving the
  // Account Portal from the publishable key, so this is a warning rather than a
  // hard failure — but the value should be fixed so config matches behavior.
  const parsedApp = parseUrl(appUrl, 'NEXT_PUBLIC_APP_URL');

  if (signInUrl.startsWith('/')) {
    console.warn(
      `Warning: NEXT_PUBLIC_AUTH_SIGN_IN_URL is a relative path ("${signInUrl}"). ` +
        "Set it to Clerk's hosted Account Portal URL, e.g. https://accounts.<your-domain>/sign-in. " +
        "The app will fall back to the Account Portal derived from the publishable key.",
    );
  } else {
    const parsedSignIn = parseUrl(
      signInUrl,
      'NEXT_PUBLIC_AUTH_SIGN_IN_URL or NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    );
    if (parsedApp && parsedSignIn && parsedSignIn.protocol !== parsedApp.protocol) {
      console.error(
        `Sign-in URL protocol mismatch. signIn=${parsedSignIn.protocol} app=${parsedApp.protocol}.`,
      );
      failed = true;
    }
    if (parsedApp && parsedSignIn && parsedSignIn.hostname === parsedApp.hostname) {
      console.warn(
        `Warning: NEXT_PUBLIC_AUTH_SIGN_IN_URL ("${signInUrl}") is on the same host as ` +
          `NEXT_PUBLIC_APP_URL ("${appUrl}"). Sign-in should be hosted on Clerk's Account Portal ` +
          '(e.g. https://accounts.<your-domain>/sign-in) to avoid a redirect loop.',
      );
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('Auth environment validation passed.');
