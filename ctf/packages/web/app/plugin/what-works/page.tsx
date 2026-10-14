import React from 'react';
import { getHostedSignInUrl, getHostedSignUpUrl } from 'lib/auth/provider-env';
import { WhatWorksPublic } from '@/components/what-works/ww-public';

// Permanently-public preview surface (same convention as /plugin/unlock). The list is
// publicly readable as a teaser; suggesting is gated behind sign-in. Sign-in and sign-up both
// happen on Clerk's hosted Account Portal; this app has no /sign-in or /sign-up page of its own.
export const dynamic = 'force-dynamic';

export default function WhatWorksPublicPage() {
  const signInUrl = getHostedSignInUrl() ?? '/';
  return <WhatWorksPublic signInUrl={signInUrl} signUpUrl={getHostedSignUpUrl() ?? signInUrl} />;
}
