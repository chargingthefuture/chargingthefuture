import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';

// Unlock gate for ClickLog, matching every other plugin: only a fully-approved (`approved_full`)
// member — or an admin — may use ClickLog. Without this, a signed-in but not-yet-unlocked user could
// create, read, or delete incidents by calling the API directly, even though the `/apps/click-log`
// page is already gated. `evaluatePluginAccess` defaults to `minUnlockTier: 'approved_full'` and
// resolves identity + unlock tier server-side.
export async function requireClickLogAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true as const, auth: decision };
}
