import Constants from 'expo-constants';

/**
 * Centralized authenticated fetch for the mobile app.
 *
 * Every call to the backend goes through here so there is ONE place that:
 *   - resolves the API base URL from runtime config (APP_URL), and
 *   - attaches the current Clerk session token as `Authorization: Bearer <jwt>`.
 *
 * The backend verifies that bearer token with Clerk's server SDK before trusting
 * any identity (see web lib/auth/request-identity.ts). The mobile app never sends
 * `x-ctf-user-*` identity headers — those are spoofable and the backend ignores
 * them on the external (bearer) path.
 *
 * The token getter is supplied by the Clerk-backed AuthProvider via
 * `registerAuthTokenGetter`, because plain API modules are not React components
 * and cannot call Clerk hooks directly.
 */

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

/**
 * Registers the function used to fetch the current Clerk session token.
 * Called once by the AuthProvider. Passing `null` clears it (e.g. on sign-out).
 */
export function registerAuthTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

type RuntimeConfig = {
  appUrl?: string;
};

function getRuntimeConfig(): RuntimeConfig {
  return (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? {}) as RuntimeConfig;
}

/**
 * Resolves the API base URL (no trailing slash) from runtime config.
 * Throws when it is missing so misconfiguration fails loudly rather than
 * silently calling the wrong host.
 */
export function getApiBaseUrl(): string {
  const appUrl = getRuntimeConfig().appUrl;
  if (typeof appUrl === 'string' && appUrl.trim().length > 0) {
    return appUrl.trim().replace(/\/$/, '');
  }
  throw new Error('APP_URL is required for mobile API calls.');
}

async function resolveAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
}

/**
 * Fetch a backend path with the current Clerk session token attached.
 *
 * @param path  An API path beginning with `/` (e.g. `/api/chyme/room`).
 * @param options  Standard fetch options. Any caller-provided headers win over
 *   the defaults except `Authorization`, which is always set from the live token.
 */
export async function authedFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await resolveAuthToken();
  const headers = new Headers(options?.headers ?? {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });
}

/**
 * Fetch a backend path and parse the JSON body, throwing a useful error on a
 * non-2xx response. Shares the bearer-token behavior of {@link authedFetch}.
 */
export async function authedFetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authedFetch(path, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `Network request failed: ${response.status}`;
    throw new Error(message);
  }
  if (payload === null) {
    throw new Error(`Expected JSON response from ${path}`);
  }
  return payload as T;
}
