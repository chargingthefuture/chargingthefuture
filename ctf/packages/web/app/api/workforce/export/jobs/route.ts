import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { reportError } from 'lib/observability/report';
import { createDeferredExportJob, insertWorkforceAdminAudit } from 'lib/workforce/repository';

type ExportBody = {
  exportType?: unknown;
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

  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const exportType = typeof body.exportType === 'string' ? body.exportType : 'summary';

  try {
    const job = await createDeferredExportJob(gate.auth.userId, exportType);

    await insertWorkforceAdminAudit({
      actorId: gate.auth.userId,
      command: 'workforce.export.job.create',
      policyStatus: 'allow',
      reason: 'export_deferred_by_product_decision',
      targetType: 'export_job',
      targetId: job.id,
      metadata: { status: job.status },
    });

    return NextResponse.json(
      {
        ok: false,
        code: WORKFORCE_ERROR_CODE.exportDeferred,
        message: 'Export workflow is deferred for this phase. Job recorded as deferred.',
        job,
      },
      { status: 501 },
    );
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'export_job_create', extra: { userId: gate.auth.userId, exportType } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to create export job.' },
      { status: 503 },
    );
  }
}
