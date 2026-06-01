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

/**
 * Reports whether a candidate redirect URL would bounce the browser back to a
 * `/sign-in` path on the app's own host.
 *
 * Sending someone to a `/sign-in` page that itself only redirects to a sign-in
 * URL produces an endless loop (`ERR_TOO_MANY_REDIRECTS`). Any URL flagged here
 * must be replaced with Clerk's hosted Account Portal (a different host) or the
 * home page before it is used as a redirect target.
 *
 * @param value - The candidate path or absolute URL.
 * @returns `true` when the target is a same-host `/sign-in` path.
 */
export function isLoopProneSignInTarget(value: string | undefined): boolean {
  if (!value) return false;
  const isSignInPath = (path: string): boolean =>
    path === '/sign-in' || path.startsWith('/sign-in/') || path.startsWith('/sign-in?');

  if (value.startsWith('/')) return isSignInPath(value);

  try {
    const parsed = new URL(value);
    const appUrl = getAppUrl();
    const sameHost = appUrl ? parsed.hostname === new URL(appUrl).hostname : false;
    return sameHost && isSignInPath(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Decodes the Clerk Frontend API host that is base64-encoded inside a Clerk
 * publishable key.
 *
 * Clerk keys look like `pk_test_<base64>` / `pk_live_<base64>`, where the
 * payload decodes to the Frontend API host followed by a `$` sentinel — e.g.
 * `clerk.app.chargingthefuture.com$` or `sure-oarfish-90.clerk.accounts.dev$`.
 *
 * `atob` is used for decoding because it is available in browsers, the Next.js
 * edge (middleware) runtime, and Node 18+ — the three runtimes this module is
 * bundled into. The function is intentionally total: any malformed key returns
 * `undefined` rather than throwing.
 *
 * @param publishableKey - The Clerk publishable key, if configured.
 * @returns The decoded Frontend API host, or `undefined` when it can't be read.
 */
function decodeClerkFrontendApiHost(publishableKey: string | undefined): string | undefined {
  if (!publishableKey) return undefined;
  const match = /^pk_(?:test|live)_(.+)$/.exec(publishableKey.trim());
  if (!match) return undefined;

  let payload = match[1].replace(/-/g, '+').replace(/_/g, '/');
  const remainder = payload.length % 4;
  if (remainder === 1) return undefined;
  if (remainder === 2) payload += '==';
  else if (remainder === 3) payload += '=';

  if (typeof atob !== 'function') return undefined;
  let decoded: string;
  try {
    decoded = atob(payload);
  } catch {
    return undefined;
  }

  const host = decoded.replace(/\$+$/, '').trim();
  return host.length > 0 ? host : undefined;
}

/**
 * Derives the origin of Clerk's hosted Account Portal from a publishable key.
 *
 * This is how Clerk hosts sign-in/sign-up on its own domains instead of on the
 * app's domain:
 * - Production custom domain: Frontend API `clerk.<domain>` →
 *   Account Portal `https://accounts.<domain>`.
 * - Development instance: Frontend API `<slug>.clerk.accounts.dev` →
 *   Account Portal `https://<slug>.accounts.dev`.
 *
 * @param publishableKey - The Clerk publishable key, if configured.
 * @returns The Account Portal origin (no trailing slash), or `undefined`.
 */
export function deriveAccountPortalOrigin(publishableKey: string | undefined): string | undefined {
  const frontendApiHost = decodeClerkFrontendApiHost(publishableKey);
  if (!frontendApiHost) return undefined;

  const devMatch = /^(.+)\.clerk\.(accounts(?:stage)?\.dev)$/i.exec(frontendApiHost);
  if (devMatch) return `https://${devMatch[1]}.${devMatch[2]}`;

  const prodMatch = /^clerk\.(.+)$/i.exec(frontendApiHost);
  if (prodMatch) return `https://accounts.${prodMatch[1]}`;

  return undefined;
}

/**
 * Returns the Account Portal origin for the currently configured provider.
 *
 * @returns The hosted Account Portal origin, or `undefined` when no usable
 *   publishable key is configured.
 */
export function getAccountPortalOrigin(): string | undefined {
  return deriveAccountPortalOrigin(getConfiguredAuthProvider()?.publishableKey);
}

/**
 * Resolves the sign-in URL the app should send people to.
 *
 * Order of precedence:
 * 1. An explicitly external configured sign-in URL (absolute and on a different
 *    host than the app) — an operator override, used as-is.
 * 2. Clerk's hosted Account Portal derived from the publishable key
 *    (`https://accounts.<domain>/sign-in`).
 *
 * A same-host or relative `/sign-in` value is deliberately ignored: it is the
 * misconfiguration that causes the redirect loop, so we fall through to the
 * hosted portal instead. Returns `undefined` only when neither source yields a
 * usable URL, in which case callers fall back to the home page (never to
 * `/sign-in`).
 *
 * @returns The hosted sign-in URL, or `undefined`.
 */
export function getHostedSignInUrl(): string | undefined {
  if (isConfiguredAuthSignInExternal()) {
    return getConfiguredAuthProvider()?.signInUrl;
  }
  const portalOrigin = getAccountPortalOrigin();
  return portalOrigin ? `${portalOrigin}/sign-in` : undefined;
}

/**
 * Resolves the sign-up URL on the same hosted Account Portal as
 * {@link getHostedSignInUrl}.
 *
 * @returns The hosted sign-up URL, or `undefined` when sign-in is not hosted on
 *   an absolute (different-host) URL.
 */
export function getHostedSignUpUrl(): string | undefined {
  const signInUrl = getHostedSignInUrl();
  if (!signInUrl) return undefined;
  try {
    return `${new URL(signInUrl).origin}/sign-up`;
  } catch {
    return undefined;
  }
}

/**
 * Resolves where to send a user after they sign out.
 *
 * Honors a configured after-sign-out URL unless it would loop back into a
 * same-host `/sign-in` page; in that case it falls back to the app home page so
 * a freshly signed-out user is never trapped in a redirect loop.
 *
 * @returns The after-sign-out URL.
 */
export function getHostedAfterSignOutUrl(): string | undefined {
  const configured = getConfiguredAuthProvider()?.afterSignOutUrl;
  if (configured && !isLoopProneSignInTarget(configured)) {
    return configured;
  }
  return getAppUrl() ?? '/';
}
