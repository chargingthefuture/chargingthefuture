import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { restrictAccount, RESTRICTION_SCOPES, type RestrictionScope } from 'lib/auth/account-restrictions';
import { lookUpAccount } from 'lib/auth/account-lookup';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RestrictBody = { targetUserId?: unknown; reason?: string; scope?: string };

function csrfDeny(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ ok: false, code: 'csrf_denied', message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }
  if (checkMutationOrigin(request) !== 'allow') {
    return NextResponse.json({ ok: false, code: 'csrf_denied', message: 'Cross-origin mutation denied.' }, { status: 403 });
  }
  return null;
}

type ParsedRestrict = { targetUserId: string; scope: RestrictionScope; reason: string | null };

// Reads and checks the body. The scope defaults to 'all' when it is left out.
async function parseRestrictBody(request: Request): Promise<{ error: NextResponse } | ParsedRestrict> {
  let body: RestrictBody;
  try {
    body = (await request.json()) as RestrictBody;
  } catch (error) {
    return { error: NextResponse.json({ ok: false, code: 'invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 }) };
  }

  const scope = body.scope;
  // Trimmed, because an id pasted with a trailing space is a different string to the database and
  // would restrict nobody while reporting success.
  const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
  if (!targetUserId || (scope !== undefined && !RESTRICTION_SCOPES.includes(scope as RestrictionScope))) {
    return { error: NextResponse.json({ ok: false, code: 'invalid_payload', message: 'targetUserId is required; scope must be all, trading, or contact.' }, { status: 400 }) };
  }
  return {
    targetUserId,
    scope: (scope as RestrictionScope | undefined) ?? 'all',
    reason: typeof body.reason === 'string' ? body.reason : null,
  };
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

  const parsed = await parseRestrictBody(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { targetUserId, scope, reason } = parsed;

  // A restriction on an id no account has protects nobody, and answering ok would tell the admin
  // the member is restricted while the real account keeps full access.
  const lookup = await lookUpAccount(targetUserId);
  if (lookup === 'not_found') {
    return NextResponse.json({ ok: false, code: 'target_not_found', message: `No account has the id ${targetUserId}. Nothing was restricted.` }, { status: 404 });
  }

  try {
    const restriction = await restrictAccount({
      targetUserId,
      actorId: decision.userId,
      reason,
      scope,
    });
    // `targetChecked` is false when the sign-in provider could not be asked, so the admin knows the
    // id was taken on trust rather than confirmed.
    return NextResponse.json({ ok: true, restriction, targetChecked: lookup === 'found' }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'account-restrictions', op: 'restrict' });
    return NextResponse.json({ ok: false, code: 'account_restrictions_error', message: `Could not restrict the account: ${failureReason(error)}` }, { status: 500 });
  }
}
