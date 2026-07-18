import React from 'react';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { UnlockShell } from '../../../components/unlock/unlock-shell';

// The Unlock flow serves not-yet-verified members, so access is only 'any_authenticated' here; the
// evaluation is used to surface the admin shortcut to admins, not to gate the screen.
export default async function UnlockPage() {
  const decision = await evaluatePluginAccess({ minUnlockTier: 'any_authenticated', requireUsername: false });
  return <UnlockShell isAdmin={decision.allowed ? decision.isAdmin : false} />;
}
