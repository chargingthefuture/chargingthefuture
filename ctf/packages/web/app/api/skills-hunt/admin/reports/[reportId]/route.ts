import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { resolveReport, type ResolveReportInput } from 'lib/skills-hunt/moderation';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';

export async function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { reportId } = await params;

  let body: Partial<ResolveReportInput>;
  try {
    body = (await request.json()) as Partial<ResolveReportInput>;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  if (body.status !== 'dismissed' && body.status !== 'archived' && body.status !== 'removed') {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'status must be dismissed | archived | removed' },
      { status: 400 },
    );
  }

  try {
    const report = await withDbTransaction((client) =>
      resolveReport(client, gate.auth.userId, reportId, {
        status: body.status as ResolveReportInput['status'],
        resolutionNotes: body.resolutionNotes ?? null,
      }),
    );
    if (!report) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Report not found or already resolved.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, report }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to resolve report.' },
      { status: 503 },
    );
  }
}
