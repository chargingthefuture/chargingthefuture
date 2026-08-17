import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { resolveReport, type ResolveReportInput } from 'lib/skills-hunt/moderation';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type ResolveReportBodyResult =
  | { ok: true; status: ResolveReportInput['status']; resolutionNotes: string | null }
  | { ok: false; message: string };

// Validate the report-resolution body: status must be one of the three allowed
// values, resolutionNotes must be a string, null, or absent (normalized to null).
function validateResolveReportBody(body: Partial<ResolveReportInput>): ResolveReportBodyResult {
  if (body.status !== 'dismissed' && body.status !== 'archived' && body.status !== 'removed') {
    return { ok: false, message: 'status must be dismissed | archived | removed' };
  }

  // resolutionNotes must be string, null, or absent. Anything else is malformed.
  if (
    body.resolutionNotes !== undefined
    && body.resolutionNotes !== null
    && typeof body.resolutionNotes !== 'string'
  ) {
    return { ok: false, message: 'resolutionNotes must be a string or null' };
  }

  return { ok: true, status: body.status, resolutionNotes: body.resolutionNotes ?? null };
}

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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const parsed = validateResolveReportBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: parsed.message },
      { status: 400 },
    );
  }

  try {
    const report = await withDbTransaction((client) =>
      resolveReport(client, gate.auth.userId, reportId, {
        status: parsed.status,
        resolutionNotes: parsed.resolutionNotes,
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
    reportError(error, { area: 'skills-hunt', op: 'admin_reports_reportid' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to resolve report: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
