import { type PluginDenyResponse } from 'lib/auth/deny-taxonomy';
import type { AllowDecision } from 'lib/auth/server-authz';

// Full ("approved") access is now decided entirely by the Unlock gate in
// evaluatePluginAccess: a route that wants approved-only access asks for the default
// minUnlockTier 'approved_full', so any AllowDecision that reaches a Chyme handler is
// already an approved user or an admin. This helper therefore has nothing left to
// enforce — it is kept as a no-op so the existing call sites stay stable.
export function ensureApprovedUserOrAdmin(_decision: AllowDecision): PluginDenyResponse | null {
  return null;
}
