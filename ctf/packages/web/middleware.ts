import { clerkMiddleware } from '@clerk/nextjs/server';
import { getClerkRuntimeOptions } from './lib/auth/clerk-env';

export default clerkMiddleware(getClerkRuntimeOptions());

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
