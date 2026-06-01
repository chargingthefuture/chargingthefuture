import { clerkMiddleware, auth } from '@clerk/nextjs/server';
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';
import { getClerkRuntimeOptions } from './lib/auth/clerk-env';

const clerkHandler = clerkMiddleware(getClerkRuntimeOptions());

async function addRequestIdentityHeaders(request: NextRequest): Promise<Headers> {
  const authState = await auth();
  const headers = new Headers(request.headers);
  headers.set('x-ctf-authenticated', authState.userId ? 'true' : 'false');
  headers.set('x-ctf-auth-provider', 'clerk');

  if (authState.userId) {
    headers.set('x-ctf-user-id', authState.userId);
  }

  return headers;
}

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const response = await clerkHandler(request, event);

  if (response.headers.get('location')) {
    return response;
  }

  const requestHeaders = await addRequestIdentityHeaders(request);
  const nextResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      nextResponse.headers.append(key, value);
    } else {
      nextResponse.headers.set(key, value);
    }
  });

  return nextResponse;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
