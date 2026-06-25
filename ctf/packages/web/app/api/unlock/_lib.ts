import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ensureUnlockAdmin } from 'lib/unlock/policy';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { reportError } from 'lib/observability/report';

// CSRF guard for unlock admin mutations that move ServiceCredits (reward grant determination, revoke).
// Requires the same `x-ctf-csrf: 1` confirmation header + same-origin check the ServiceCredits admin uses,
// so a destructive money action can't be driven cross-origin. Returns a 403 response to short-circuit, or
// null when the request is allowed.
export function ensureUnlockMutationCsrf(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ ok: false, message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json({ ok: false, message: 'Invalid request origin metadata.' }, { status: 403 });
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json({ ok: false, message: 'Cross-origin mutation denied by CSRF policy.' }, { status: 403 });
  }
  return null;
}

// Validate and normalize a Quora profile URL. Returns the canonical form (host lowercased, hash and
// query stripped) or null when the URL is not a valid Quora profile link. Shared by the member
// submission path and the admin URL-edit path so both apply the exact same rules.
export function normalizeQuoraProfileUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    if (host !== 'quora.com' && host !== 'www.quora.com') {
      return null;
    }

    if (!parsed.pathname.startsWith('/profile/')) {
      return null;
    }

    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'normalize_quora_url' });
    return null;
  }
}

export async function requireUnlockUserAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'any_authenticated' });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}

export async function requireUnlockAdminAccess() {
  const gate = await requireUnlockUserAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureUnlockAdmin(gate.auth);
  if (deny) {
    return { allowed: false as const, response: NextResponse.json(deny, { status: deny.status }) };
  }

  return gate;
}

export function unlockErrorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, message }, { status });
}
