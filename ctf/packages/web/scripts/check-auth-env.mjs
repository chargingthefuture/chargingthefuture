const publishableKey = process.env.NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY;
const secretKey = process.env.AUTH_SECRET_KEY;

if (!publishableKey && !secretKey) {
  console.log('No auth provider environment is configured. Skipping auth env validation.');
  process.exit(0);
}

let failed = false;

function require(key) {
  if (!process.env[key] || !String(process.env[key]).trim().length) {
    console.error(`Missing required auth env: ${key}`);
    failed = true;
  }

  return process.env[key];
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

const appUrl = require('NEXT_PUBLIC_APP_URL');
require('NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY');
require('AUTH_SECRET_KEY');

const signInUrl = process.env.NEXT_PUBLIC_AUTH_SIGN_IN_URL;
if (signInUrl) {
  const parsedApp = parseUrl(appUrl, 'NEXT_PUBLIC_APP_URL');
  const parsedSignIn = parseUrl(signInUrl, 'NEXT_PUBLIC_AUTH_SIGN_IN_URL');
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
