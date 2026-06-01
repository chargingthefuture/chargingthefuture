import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportAdminAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { insertTrustTransportAudit, restrictAccount } from 'lib/trusttransport/repository';
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
  }

  const reason = typeof body.reason === 'string' ? body.reason : null;

  try {
    await restrictAccount(userId, gate.auth.userId, reason);
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trusttransport.admin.account.restrict',
      policyStatus: 'allow',
      reason: reason ?? 'restricted',
      targetType: 'account',
      targetId: userId,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'admin_accounts_userid_restrict' });
    return trustTransportErrorResponse(error, 'Account restrict unavailable.');
  }
}
