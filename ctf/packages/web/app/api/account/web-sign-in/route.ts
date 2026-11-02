import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';
import { WebSignInUnavailable, createWebSignInToken, safeNextPath, webSignInPath } from 'lib/auth/web-sign-in';

// POST /api/account/web-sign-in { next }: the Android app asks for a one-time sign-in link to a page
// of the web app, so the browser panel opens it signed in as the same member. Approved members
// (the default tier). The answer is a path on this site: /auth/handoff?next=...#ticket=... The
// token lasts a minute and is spent on first use; it is never logged.

export const dynamic = 'force-dynamic';

const LINKS_PER_MINUTE = 20;

function deny(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request: Request) {
  if (request.headers.get('x-ctf-csrf') !== '1') return deny('csrf_denied', 'Missing CSRF confirmation header.', 403);
  if (checkMutationOrigin(request) !== 'allow') return deny('csrf_denied', 'Cross-origin request denied.', 403);
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) return NextResponse.json(decision, { status: decision.status });

  const limit = checkRateLimit(`account:web-sign-in:${decision.userId}`, LINKS_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', message: 'Too many sign-in links in a minute. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const body = (await request.json().catch(() => null)) as { next?: unknown } | null;
  const next = safeNextPath(body?.next);
  try {
    const ticket = await createWebSignInToken(decision.userId);
    return NextResponse.json({ ok: true, path: webSignInPath(next, ticket) }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof WebSignInUnavailable)) reportError(error, { area: 'account', op: 'web_sign_in_token' });
    return deny('web_sign_in_unavailable', `A sign-in link could not be made: ${error instanceof Error ? error.message : 'the sign-in provider did not answer'}.`, 503);
  }
}
