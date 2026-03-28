import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { getClerkRuntimeOptions } from './lib/auth/clerk-env';

const isProtectedWebRoute = createRouteMatcher(['/apps(.*)', '/plugin(.*)', '/admin(.*)']);
const clerkRuntimeOptions = getClerkRuntimeOptions();

import { NextResponse } from 'next/server';

// Always export a top-level middleware function. The runtime behavior (no-op vs Clerk middleware) is chosen at runtime
// based on NEXT_PUBLIC_DISABLE_AUTH. Exporting conditionally caused compilation errors because exports must be top-level.

import type { NextRequest } from 'next/server';
const actualMiddleware = (process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true')
  ? (req: NextRequest) => NextResponse.next()
  : clerkMiddleware((auth, req: NextRequest) => {
      if (isProtectedWebRoute(req)) {
        auth().protect();
      }
    }, clerkRuntimeOptions);


import type { NextFetchEvent } from 'next/server';

export default function middleware(req: import('next/server').NextRequest, event: NextFetchEvent) {
  return actualMiddleware(req, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
