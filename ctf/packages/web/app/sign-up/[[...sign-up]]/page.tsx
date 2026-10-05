import { redirect } from 'next/navigation';
import { getHostedSignUpUrl } from 'lib/auth/clerk-env';

// Sign-up is handled by Clerk's hosted Account Portal (accounts.<domain>), the
// same portal the /sign-in catch-all forwards to. This page forwards any in-app
// `/sign-up` link (for example the WhatWorks public preview's Create Account
// button) there. `getHostedSignUpUrl()` only ever returns a URL on that
// different host, or `undefined`, so this cannot redirect back to `/sign-up`.
// Only when no hosted portal is configured does the page render, and then
// sign-up really is not available on this host.
export default function SignUpPage() {
  const hostedSignUpUrl = getHostedSignUpUrl();
  if (hostedSignUpUrl) {
    redirect(hostedSignUpUrl);
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ctf-bg, #0F1117)',
      }}
    >
      <p>Sign up is not available.</p>
    </div>
  );
}
