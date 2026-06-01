import { NextResponse } from 'next/server';
import { requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { getExportJobById } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';

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

    return NextResponse.json({ job }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'export_jobs_jobid' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch export job.' },
      { status: 503 },
    );
  }
}
