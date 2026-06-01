import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { insertLighthouseAudit, removeBlock } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{ blockedUserId: string }>;
};

export async function DELETE(request: Request, { params }: RouteParams) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { blockedUserId } = await params;

  try {
    const removed = await removeBlock(gate.auth.userId, blockedUserId);
    if (!removed) {
      return NextResponse.json(
        { ok: false, code: LIGHTHOUSE_ERROR_CODE.blockNotFound, message: 'Lighthouse block not found.' },
        { status: 404 },
      );
    }

    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.block.delete',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'block',
      targetId: blockedUserId,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'block_delete', extra: { userId: gate.auth.userId, blockedUserId } });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Block remove unavailable.' },
      { status: 503 },
    );
  }
}
