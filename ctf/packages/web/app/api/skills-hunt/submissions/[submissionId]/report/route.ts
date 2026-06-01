import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntReadAccess } from '../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { createReport, validateCreateReportInput, type CreateReportInput } from 'lib/skills-hunt/moderation';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';

export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const gate = await requireSkillsHuntReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { submissionId } = await params;

  let body: Partial<CreateReportInput>;
  try {
    body = (await request.json()) as Partial<CreateReportInput>;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input: CreateReportInput = {
    submissionId,
    directoryProfileId: null,
    reason: body.reason ?? 'other',
    details: body.details ?? null,
  };

  const validation = validateCreateReportInput(input);
  if (validation) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: validation },
      { status: 400 },
    );
  }

  try {
    const report = await withDbTransaction((client) =>
      createReport(client, gate.auth.userId, gate.auth.username, input),
    );
    return NextResponse.json({ ok: true, report }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'create_report', extra: { userId: gate.auth.userId, submissionId } });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to file report.' },
      { status: 503 },
    );
  }
}
