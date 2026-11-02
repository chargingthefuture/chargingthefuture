import { createClerkClient } from '@clerk/backend';
import { getClerkSecretKey } from './clerk-env';

// The Android app's way into a web page without a second sign-in: the app asks for a one-time
// sign-in token for the member it has signed in, then opens /auth/handoff#ticket=... in a browser
// panel; that page spends the token and goes on to the page asked for. The token lasts a minute and
// is spent on first use, and it rides after the # so it never reaches a server log.

export const WEB_SIGN_IN_TOKEN_SECONDS = 60;
export const WEB_SIGN_IN_PAGE = '/auth/handoff';

// A page of this app to go to, or '/' for anything else: only a path on this site, never another
// site (no "//", no scheme, no backslash), so the hand-off cannot send a member somewhere else.
export function safeNextPath(next: unknown): string {
  if (typeof next !== 'string') return '/';
  const path = next.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\r\n]/.test(path)) return '/';
  if (path.startsWith(WEB_SIGN_IN_PAGE)) return '/';
  return path.slice(0, 500);
}

export function webSignInPath(next: string, ticket: string): string {
  return `${WEB_SIGN_IN_PAGE}?next=${encodeURIComponent(next)}#ticket=${encodeURIComponent(ticket)}`;
}

export class WebSignInUnavailable extends Error {}

export async function createWebSignInToken(userId: string): Promise<string> {
  const secretKey = getClerkSecretKey();
  if (!secretKey) throw new WebSignInUnavailable('The sign-in provider has no secret key in this environment.');
  const token = await createClerkClient({ secretKey }).signInTokens.createSignInToken({
    userId,
    expiresInSeconds: WEB_SIGN_IN_TOKEN_SECONDS,
  });
  return token.token;
}
