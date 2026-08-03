import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { restrictAccount, RESTRICTION_SCOPES, type RestrictionScope } from 'lib/auth/account-restrictions';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RestrictBody = { targetUserId?: string; reason?: string; scope?: string };

function csrfDeny(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ ok: false, code: 'csrf_denied', message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }
  if (checkMutationOrigin(request) !== 'allow') {
    return NextResponse.json({ ok: false, code: 'csrf_denied', message: 'Cross-origin mutation denied.' }, { status: 403 });
  }
  return null;
}

// Admin-only: restrict a member platform-wide. Scope 'all' blocks every product route; 'trading' blocks
// value movement; 'contact' blocks initiating matches/connections.
export async function POST(request: Request) {
  const deny = csrfDeny(request);
  if (deny) {
    return deny;
  }

  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  let body: RestrictBody;
  try {
    body = (await request.json()) as RestrictBody;
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 });
  }

  const scope = body.scope;
  if (!body.targetUserId || (scope !== undefined && !RESTRICTION_SCOPES.includes(scope as RestrictionScope))) {
    return NextResponse.json({ ok: false, code: 'invalid_payload', message: 'targetUserId is required; scope must be all, trading, or contact.' }, { status: 400 });
  }

  try {
    const restriction = await restrictAccount({
      targetUserId: body.targetUserId,
      actorId: decision.userId,
      reason: typeof body.reason === 'string' ? body.reason : null,
      scope: (scope as RestrictionScope | undefined) ?? 'all',
    });
    return NextResponse.json({ ok: true, restriction }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'account-restrictions', op: 'restrict' });
    return NextResponse.json({ ok: false, code: 'account_restrictions_error', message: `Could not restrict the account: ${failureReason(error)}` }, { status: 500 });
  }
}
