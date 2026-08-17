import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { unrestrictAccount } from 'lib/auth/account-restrictions';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type UnrestrictBody = { targetUserId?: string };

function csrfDeny(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ ok: false, code: 'csrf_denied', message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }
  if (checkMutationOrigin(request) !== 'allow') {
    return NextResponse.json({ ok: false, code: 'csrf_denied', message: 'Cross-origin mutation denied.' }, { status: 403 });
  }
  return null;
}

// Admin-only: lift a member's platform-wide restriction.
export async function POST(request: Request) {
  const deny = csrfDeny(request);
  if (deny) {
    return deny;
  }

  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  let body: UnrestrictBody;
  try {
    body = (await request.json()) as UnrestrictBody;
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 });
  }

  if (!body.targetUserId) {
    return NextResponse.json({ ok: false, code: 'invalid_payload', message: 'targetUserId is required.' }, { status: 400 });
  }

  try {
    const restriction = await unrestrictAccount({ targetUserId: body.targetUserId, actorId: decision.userId });
    return NextResponse.json({ ok: true, restriction }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'account-restrictions', op: 'unrestrict' });
    return NextResponse.json({ ok: false, code: 'account_restrictions_error', message: `Could not lift the restriction: ${failureReason(error)}` }, { status: 500 });
  }
}
