import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getClerkRuntimeOptions } from './lib/auth/clerk-env';

// Identity headers that the app reads in `lib/auth/request-identity.ts`. The
// middleware is the only thing allowed to set them, so we always clear whatever
// the client sent and then write the values we can actually verify from Clerk.
// This both makes the signed-in user visible to the rest of the app and stops a
// caller from spoofing these headers to look authenticated.
const MANAGED_IDENTITY_HEADERS = [
  'x-ctf-authenticated',
  'x-ctf-auth-provider',
  'x-ctf-user-id',
  'x-ctf-username',
  'x-ctf-user-role',
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function claimString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Clerk does NOT include the username or public metadata in the session token by
// default, so these reads return `undefined` until the session token is
// customized. To populate them, in the Clerk dashboard go to
// Configure → Sessions → "Customize session token" and add:
//   { "username": "{{user.username}}", "metadata": "{{user.public_metadata}}" }
// and store roles in the user's public metadata (e.g. { "role": "admin" }).
// Until then the app falls back to the anonymous display name and no role — no
// regression. Both the flat (`username`/`role`) and nested-in-`metadata`
// shapes are accepted so either claim mapping works.
function extractUsername(claims: unknown): string | undefined {
  const root = asRecord(claims);
  if (!root) return undefined;
  return claimString(root.username) ?? claimString(asRecord(root.metadata)?.username);
}

function extractRole(claims: unknown): string | undefined {
  const root = asRecord(claims);
  if (!root) return undefined;
  const metadata = asRecord(root.metadata) ?? asRecord(root.public_metadata);
  return claimString(root.role) ?? claimString(metadata?.role);
}

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth();

  const requestHeaders = new Headers(request.headers);
  for (const header of MANAGED_IDENTITY_HEADERS) {
    requestHeaders.delete(header);
  }

  requestHeaders.set('x-ctf-authenticated', userId ? 'true' : 'false');
  requestHeaders.set('x-ctf-auth-provider', 'clerk');
  if (userId) {
    requestHeaders.set('x-ctf-user-id', userId);

    const username = extractUsername(sessionClaims);
    if (username) {
      requestHeaders.set('x-ctf-username', username);
    }

    const role = extractRole(sessionClaims);
    if (role) {
      requestHeaders.set('x-ctf-user-role', role);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}, getClerkRuntimeOptions());

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
