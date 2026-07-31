import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportAdminAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { insertTrustTransportAudit, restrictAccount } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { userId } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body is optional here; a missing or malformed JSON body leaves the empty defaults in place.
  }

  const reason = typeof body.reason === 'string' ? body.reason : null;

  try {
    await restrictAccount(userId, gate.auth.userId, reason);
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.admin.account.restrict',
      policyStatus: 'allow',
      reason: reason ?? 'restricted',
      targetType: 'account',
      targetId: userId,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'admin_accounts_userid_restrict' });
    return trustTransportErrorResponse(error, 'Account restrict unavailable.');
  }
}
