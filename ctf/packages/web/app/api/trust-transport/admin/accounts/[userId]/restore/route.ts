import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportAdminAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { insertTrustTransportAudit, restoreAccount } from 'lib/trust-transport/repository';
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

  try {
    await restoreAccount(userId, gate.auth.userId);
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.admin.account.restore',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'account',
      targetId: userId,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'admin_accounts_userid_restore' });
    return trustTransportErrorResponse(error, 'Account restore unavailable.');
  }
}
