const AUTH_TARGETS = ['railway-staging', 'railway-production', 'vercel-staging'];

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0);
}

function hasAnyValue(keys) {
  return keys.some((key) => typeof process.env[key] === 'string' && process.env[key].trim().length > 0);
}

function requireOneOf(label, keys) {
  const resolved = firstNonEmpty(...keys.map((key) => process.env[key]));
  if (!resolved) {
    console.error(`Missing required auth ${label}. Provide one of:`);
    keys.forEach((key) => console.error(`  - ${key}`));
    process.exit(1);
  }

  return resolved;
}

function parseUrl(value, label) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    console.error(`Invalid ${label}: ${value}`);
    process.exit(1);
  }
}

function inferAuthTarget() {
  const explicitTarget = firstNonEmpty(process.env.AUTH_ENV_TARGET, process.env.CLERK_ENV_TARGET);
  if (explicitTarget) {
    return explicitTarget;
  }

  if (
    hasAnyValue([
      'RAILWAY_PROD_NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY',
      'RAILWAY_PROD_AUTH_SECRET_KEY',
      'RAILWAY_PROD_AUTH_SIGN_IN_URL',
      'RAILWAY_PROD_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'RAILWAY_PROD_CLERK_SECRET_KEY',
      'RAILWAY_PROD_CLERK_SIGN_IN_URL',
    ])
  ) {
    return 'railway-production';
  }

  if (
    hasAnyValue([
      'RAILWAY_STAGING_NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY',
      'RAILWAY_STAGING_AUTH_SECRET_KEY',
      'RAILWAY_STAGING_AUTH_SIGN_IN_URL',
      'RAILWAY_STAGING_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'RAILWAY_STAGING_CLERK_SECRET_KEY',
      'RAILWAY_STAGING_CLERK_SIGN_IN_URL',
    ])
  ) {
    return 'railway-staging';
  }

  const appUrl = parseUrl(firstNonEmpty(process.env.NEXT_PUBLIC_APP_URL, process.env.RAILWAY_NEXT_PUBLIC_APP_URL), 'NEXT_PUBLIC_APP_URL');
  const host = appUrl?.host ?? '';
  if (host === 'beta.chargingthefuture.com' || host.includes('staging')) {
    return 'railway-staging';
  }
  if (host === 'chargingthefuture.com' || host === 'www.chargingthefuture.com' || host.includes('railway')) {
    return 'railway-production';
  }

  return null;
}

function getScopedKeys(target, genericName, legacyName) {
  switch (target) {
    case 'railway-staging':
      return [`RAILWAY_STAGING_${genericName}`, `RAILWAY_STAGING_${legacyName}`];
    case 'railway-production':
      return [`RAILWAY_PROD_${genericName}`, `RAILWAY_PROD_${legacyName}`];
    case 'vercel-staging':
      return [`VERCEL_${genericName}`, `VERCEL_${legacyName}`];
    default:
      return [];
  }
}

const authEnvPresenceKeys = [
  'NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY',
  'AUTH_SECRET_KEY',
  'AUTH_SIGN_IN_URL',
  'NEXT_PUBLIC_AUTH_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'RAILWAY_STAGING_NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY',
  'RAILWAY_STAGING_AUTH_SECRET_KEY',
  'RAILWAY_STAGING_AUTH_SIGN_IN_URL',
  'RAILWAY_PROD_NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY',
  'RAILWAY_PROD_AUTH_SECRET_KEY',
  'RAILWAY_PROD_AUTH_SIGN_IN_URL',
  'RAILWAY_STAGING_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'RAILWAY_STAGING_CLERK_SECRET_KEY',
  'RAILWAY_STAGING_CLERK_SIGN_IN_URL',
  'RAILWAY_PROD_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'RAILWAY_PROD_CLERK_SECRET_KEY',
  'RAILWAY_PROD_CLERK_SIGN_IN_URL',
];

if (!hasAnyValue(authEnvPresenceKeys)) {
  console.log('No auth provider environment is configured. Skipping auth env validation.');
  process.exit(0);
}

const authTarget = inferAuthTarget();
if (!authTarget || !AUTH_TARGETS.includes(authTarget)) {
  console.error('Could not determine AUTH_ENV_TARGET. Set AUTH_ENV_TARGET or CLERK_ENV_TARGET to one of: railway-staging, railway-production, vercel-staging.');
  process.exit(1);
}

const appUrl = requireOneOf('app URL', ['NEXT_PUBLIC_APP_URL', 'RAILWAY_NEXT_PUBLIC_APP_URL']);
const parsedAppUrl = parseUrl(appUrl, 'NEXT_PUBLIC_APP_URL');
const publishableKey = requireOneOf('publishable key', [
  'NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY',
  ...getScopedKeys(authTarget, 'NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
]);
const secretKey = requireOneOf('secret key', [
  'AUTH_SECRET_KEY',
  ...getScopedKeys(authTarget, 'AUTH_SECRET_KEY', 'CLERK_SECRET_KEY'),
  'CLERK_SECRET_KEY',
]);
const signInUrl = firstNonEmpty(
  process.env.AUTH_SIGN_IN_URL,
  process.env.NEXT_PUBLIC_AUTH_SIGN_IN_URL,
  ...getScopedKeys(authTarget, 'AUTH_SIGN_IN_URL', 'CLERK_SIGN_IN_URL').map((key) => process.env[key]),
  process.env.CLERK_SIGN_IN_URL,
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
);

void publishableKey;
void secretKey;

const parsedSignInUrl = parseUrl(signInUrl, 'auth sign-in URL');
if (parsedAppUrl && parsedSignInUrl && parsedSignInUrl.protocol !== parsedAppUrl.protocol) {
  console.error(
    `Sign-in URL protocol mismatch. signIn=${parsedSignInUrl.protocol} app=${parsedAppUrl.protocol}.`,
  );
  process.exit(1);
}

console.log(`Auth environment validation passed for target: ${authTarget}`);
