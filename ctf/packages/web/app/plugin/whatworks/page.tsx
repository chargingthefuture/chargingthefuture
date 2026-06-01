import React from 'react';
import { WhatWorksPublic } from '@/components/whatworks/ww-public';

// Permanently-public preview surface (same convention as /plugin/unlock). The list is
// publicly readable as a teaser; suggesting is gated behind sign-in.
export const dynamic = 'force-dynamic';

export default function WhatWorksPublicPage() {
  return <WhatWorksPublic />;
}
