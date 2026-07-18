import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { pluginAuthDeny } from 'lib/auth/deny-taxonomy';
import { insertContributorAccessAudit } from 'lib/contributor-access/repository';

// Contributor Access admin gate. Admin-only (requiredRoles [admin] in the access-policy contract —
// no operations role here: revoke/reinstate are standing decisions, owner-level). Every allow AND
// deny writes a contributor_access_audit_trail row; the deny write uses the signed-in user id when
// there is one and 'anonymous' otherwise.
export async function requireContributorAccessAdmin(
  command: string,
): Promise<{ allowed: true; auth: AllowDecision } | { allowed: false; response: NextResponse }> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    await insertContributorAccessAudit({
      actorId: 'anonymous',
      command,
      policyStatus: 'deny',
      reason: decision.reason,
      targetType: 'route',
      targetId: command,
    });
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }

  if (!decision.isAdmin) {
    const deny = pluginAuthDeny.forbiddenRole(['admin']);
    await insertContributorAccessAudit({
      actorId: decision.userId,
      command,
      policyStatus: 'deny',
      reason: deny.reason,
      targetType: 'route',
      targetId: command,
    });
    return { allowed: false, response: NextResponse.json(deny, { status: deny.status }) };
  }

  return { allowed: true, auth: decision };
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_csrf_denied', message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_csrf_denied', message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_csrf_denied', message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}
