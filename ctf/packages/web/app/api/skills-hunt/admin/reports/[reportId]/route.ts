import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { resolveReport, type ResolveReportInput } from 'lib/skills-hunt/moderation';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';

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

  // resolutionNotes must be string, null, or absent. Anything else is malformed.
  if (
    body.resolutionNotes !== undefined
    && body.resolutionNotes !== null
    && typeof body.resolutionNotes !== 'string'
  ) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'resolutionNotes must be a string or null' },
      { status: 400 },
    );
  }
  const resolutionNotes: string | null = body.resolutionNotes ?? null;

  try {
    const report = await withDbTransaction((client) =>
      resolveReport(client, gate.auth.userId, reportId, {
        status: body.status as ResolveReportInput['status'],
        resolutionNotes,
      }),
    );
    if (!report) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Report not found or already resolved.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, report }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'resolve_report', extra: { userId: gate.auth.userId, reportId } });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to resolve report.' },
      { status: 503 },
    );
  }
}
