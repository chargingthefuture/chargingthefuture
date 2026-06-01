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
];

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  const requestHeaders = new Headers(request.headers);
  for (const header of MANAGED_IDENTITY_HEADERS) {
    requestHeaders.delete(header);
  }

  requestHeaders.set('x-ctf-authenticated', userId ? 'true' : 'false');
  requestHeaders.set('x-ctf-auth-provider', 'clerk');
  if (userId) {
    requestHeaders.set('x-ctf-user-id', userId);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}, getClerkRuntimeOptions());

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
