import { NextResponse } from 'next/server';
import { requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { reportError } from 'lib/observability/report';
import { getExportJobById } from 'lib/workforce/repository';

type RouteParams = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { jobId } = await params;

  try {
    const job = await getExportJobById(jobId);
    if (!job) {
      return NextResponse.json(
        { ok: false, code: WORKFORCE_ERROR_CODE.notFound, message: 'Export job not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: WORKFORCE_ERROR_CODE.exportDeferred,
        message: 'Export result retrieval is deferred for this phase.',
        job,
      },
      { status: 501 },
    );
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'export_job_result_get', extra: { userId: gate.auth.userId, jobId } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch export result.' },
      { status: 503 },
    );
  }
}
