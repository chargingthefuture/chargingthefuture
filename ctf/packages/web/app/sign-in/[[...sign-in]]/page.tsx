import { redirect } from 'next/navigation';
import { getClerkSignInUrl } from 'lib/auth/clerk-env';

// Sign-in is handled by the hosted account flow outside this app surface.
// This page remains as a catch-all for legacy links or misconfigured redirects.
export default function SignInPage() {
  const signInUrl = getClerkSignInUrl();
  if (signInUrl) {
    redirect(signInUrl);
  }

  redirect('/');
}
