import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ensureUnlockAdmin } from 'lib/unlock/policy';
import { reportError } from 'lib/observability/report';

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
