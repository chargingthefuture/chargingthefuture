import { redirect } from 'next/navigation';
import { getHostedSignInUrl } from 'lib/auth/clerk-env';

// Sign-in is handled by Clerk's hosted Account Portal (accounts.<domain>), not
// by a sign-in page rendered on this app's own domain. This catch-all only
// exists to forward any legacy or in-app `/sign-in` link over to that hosted
// portal. `getHostedSignInUrl()` only ever returns an Account Portal URL (a
// different host) or `undefined`, so this can never redirect back to `/sign-in`
// on this host — which is what previously caused an endless redirect loop
// (ERR_TOO_MANY_REDIRECTS).
export default function SignInPage() {
  redirect(getHostedSignInUrl() ?? '/');
}
