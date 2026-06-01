import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { runIncrementalRecruitedSync } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';

type SyncBody = {
  batchSize?: number;
};

export async function POST(request: Request) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: SyncBody = {};
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    body = {};
  }

  try {
    const result = await runIncrementalRecruitedSync(gate.auth.userId, {
      batchSize: Number.isFinite(body.batchSize) ? Number(body.batchSize) : undefined,
      source: 'admin_sync_route',
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_sync' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to run incremental sync.' },
      { status: 503 },
    );
  }
}
