import { getEnvValue } from './env-utils.mjs';

/**
 * Resolved auth-provider configuration for the current runtime.
 *
 * `publishableKey`, `signInUrl`, `afterSignOutUrl` and `providerName` come from
 * build-time-inlined `NEXT_PUBLIC_*` values; `secretKey` is a server-only
 * runtime value and is never inlined into a client/edge bundle.
 */
export type AuthProviderRuntimeConfig = {
  providerName: string;
  publishableKey?: string;
  secretKey?: string;
  signInUrl?: string;
  afterSignOutUrl?: string;
};

/**
 * Returns the first value that is a non-empty string after trimming, or
 * `undefined` if none qualify.
 *
 * Used for the public env reads below, which are passed as STATIC
 * `process.env.NEXT_PUBLIC_*` expressions (see {@link getConfiguredAuthProvider}
 * for why static access matters).
 *
 * @param values - Candidate values in priority order.
 * @returns The first trimmed, non-empty value, or `undefined`.
 */
function firstNonEmptyTrimmed(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
}

/**
 * Normalizes a sign-in/redirect URL value.
 *
 * Relative paths (starting with `/`) are returned as-is; absolute URLs are
 * parsed and re-serialized. Anything that fails to parse returns `undefined`.
 *
 * @param value - The raw URL or path, if any.
 * @returns The normalized path/URL, or `undefined` when absent or invalid.
 */
function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('/')) return value;
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

/**
 * Returns the configured public app URL (`NEXT_PUBLIC_APP_URL`), if set.
 *
 * Read as a static `process.env.NEXT_PUBLIC_*` expression so Next.js inlines it
 * at build time into the client and edge bundles.
 *
 * @returns The app URL, or `undefined` when not configured.
 */
export function getAppUrl(): string | undefined {
  return firstNonEmptyTrimmed(process.env.NEXT_PUBLIC_APP_URL);
}

/**
 * Resolves the active auth provider configuration from the environment.
 *
 * IMPORTANT: every `NEXT_PUBLIC_*` value must be read as a STATIC
 * `process.env.NEXT_PUBLIC_FOO` member expression. Next.js only inlines public
 * env vars at build time when they are referenced statically; reading them
 * through a dynamic `process.env[key]` helper (`getEnvValue`) prevents the
 * inlining. `NEXT_PUBLIC_*` vars are also not present in the edge (middleware)
 * runtime's `process.env` at runtime, so a dynamic read leaves the publishable
 * key undefined inside `clerkMiddleware` — which then throws
 * "Missing publishableKey" and fails the health check. Reading them statically
 * bakes the values into both the client and the edge bundle. The secret key is
 * server-only and is read dynamically from the runtime environment so it is
 * never inlined into a bundle.
 *
 * @returns The resolved provider config, or `null` when nothing is configured.
 */
export function getConfiguredAuthProvider(): AuthProviderRuntimeConfig | null {
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

/**
 * Returns just the publishable/secret keys for initializing the auth SDK
 * (`ClerkProvider` and `clerkMiddleware`).
 *
 * @returns An object with `publishableKey`/`secretKey` when configured;
 *   otherwise an empty object.
 */
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

/**
 * Reports whether the configured sign-in URL points to a different host than
 * the app itself (i.e. an externally hosted sign-in page).
 *
 * Relative sign-in paths are treated as internal. When no app URL is
 * configured, an absolute sign-in URL is treated as external.
 *
 * @returns `true` when sign-in is hosted on a different host; otherwise `false`.
 */
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
