import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { reportError } from 'lib/observability/report';
import { enqueueRecruitedRecompute } from 'lib/workforce/repository';

export async function POST(request: Request) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    const result = await enqueueRecruitedRecompute(gate.auth.userId);
    return NextResponse.json({ ok: true, ...result }, { status: 202 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_recompute_enqueue', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to enqueue recompute.' },
      { status: 503 },
    );
  }
}
