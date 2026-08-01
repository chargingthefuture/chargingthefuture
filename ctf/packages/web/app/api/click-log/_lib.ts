import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';

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

// Admin gate for the owner trends surface: the member gate above, plus the admin role. Non-admins
// get a 403 rather than an empty result so a misrouted client fails loudly.
export async function requireClickLogAdminAccess() {
  const gate = await requireClickLogAccess();
  if (!gate.allowed) {
    return gate;
  }
  if (!gate.auth.isAdmin) {
    return {
      allowed: false as const,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }
  return gate;
}

// CSRF enforcement for mutating ClickLog requests, matching the sibling plugins (mood/gdp/etc.):
// the custom `x-ctf-csrf: 1` header must be present (both the web shell and the mobile client send
// it) and the request origin must be same-origin. Returns null when the request may proceed.
export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ error: 'Missing CSRF confirmation header' }, { status: 403 });
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck !== 'allow') {
    return NextResponse.json({ error: 'Cross-origin mutation denied by CSRF policy' }, { status: 403 });
  }
  return null;
}
