import { getEnvValue } from './env-utils.mjs';

export type AuthProviderRuntimeConfig = {
  providerName: string;
  publishableKey?: string;
  secretKey?: string;
  signInUrl?: string;
  afterSignOutUrl?: string;
};

// Returns the first non-empty, trimmed value. Used for the public env reads
// below, which are passed as STATIC `process.env.NEXT_PUBLIC_*` expressions
// (see getConfiguredAuthProvider for why static access matters).
function firstNonEmptyTrimmed(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
}

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('/')) return value;
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

export function getAppUrl(): string | undefined {
  // Static reference so Next.js inlines it at build time (see below).
  return firstNonEmptyTrimmed(process.env.NEXT_PUBLIC_APP_URL);
}

export function getConfiguredAuthProvider(): AuthProviderRuntimeConfig | null {
  // IMPORTANT: every `NEXT_PUBLIC_*` value must be read as a STATIC
  // `process.env.NEXT_PUBLIC_FOO` member expression. Next.js only inlines
  // public env vars at build time when they are referenced statically; reading
  // them through a dynamic `process.env[key]` helper (getEnvValue) prevents the
  // inlining. `NEXT_PUBLIC_*` vars are also not present in the edge (middleware)
  // runtime's `process.env` at runtime, so a dynamic read leaves the publishable
  // key undefined inside `clerkMiddleware` — which then throws
  // "Missing publishableKey" and fails the health check. Reading them statically
  // bakes the values into both the client and the edge bundle.
  const publishableKey = firstNonEmptyTrimmed(
    process.env.NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const signInUrl = normalizeUrl(
    firstNonEmptyTrimmed(
      process.env.NEXT_PUBLIC_AUTH_SIGN_IN_URL,
      process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    ),
  );
  const afterSignOutUrl = normalizeUrl(
    firstNonEmptyTrimmed(
      process.env.NEXT_PUBLIC_AUTH_AFTER_SIGN_OUT_URL,
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL,
      signInUrl,
    ),
  );
  const providerName = firstNonEmptyTrimmed(process.env.NEXT_PUBLIC_AUTH_PROVIDER) ?? 'clerk';

  // The secret key is server-only and must NEVER be inlined into a client/edge
  // bundle, so it is read dynamically from the runtime environment (non-public
  // vars are available in `process.env` at runtime, including in middleware).
  const secretKey = getEnvValue('AUTH_SECRET_KEY', 'CLERK_SECRET_KEY');

  if (!publishableKey && !secretKey && !signInUrl && !afterSignOutUrl) {
    return null;
  }

  return {
    providerName,
    ...(publishableKey ? { publishableKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(signInUrl ? { signInUrl } : {}),
    ...(afterSignOutUrl ? { afterSignOutUrl } : {}),
  };
}

export function getAuthRuntimeOptions(): {
  publishableKey?: string;
  secretKey?: string;
} {
  const provider = getConfiguredAuthProvider();
  if (!provider) return {};
  return {
    ...(provider.publishableKey ? { publishableKey: provider.publishableKey } : {}),
    ...(provider.secretKey ? { secretKey: provider.secretKey } : {}),
  };
}

export function isConfiguredAuthSignInExternal(): boolean {
  const provider = getConfiguredAuthProvider();
  const signInUrl = provider?.signInUrl;
  if (!signInUrl || signInUrl.startsWith('/')) return false;

  try {
    const parsedSignIn = new URL(signInUrl);
    const appUrl = getAppUrl();
    if (!appUrl) return true;
    return parsedSignIn.hostname !== new URL(appUrl).hostname;
  } catch {
    return false;
  }
}
