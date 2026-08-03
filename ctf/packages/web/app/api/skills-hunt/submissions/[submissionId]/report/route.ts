import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntSubmitAccess } from '../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { createReport, validateCreateReportInput, type CreateReportInput } from 'lib/skills-hunt/moderation';
import { insertSkillsHuntAudit } from 'lib/skills-hunt/repository';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  // Filing a report is an authenticated-member write, not a plain read — use the submit gate,
  // which the access policy (`skills-hunt.submission.report`) and the _lib comment both name as
  // the intended gate for report filing.
  const gate = await requireSkillsHuntSubmitAccess();
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
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

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.report',
      policyStatus: 'allow',
      reason: 'community_moderation',
      targetType: 'submission',
      targetId: submissionId,
      metadata: { reportId: report.id, reason: input.reason, directoryProfileId: input.directoryProfileId },
    });

    return NextResponse.json({ ok: true, report }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'submissions_submissionid_report' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to file report.' },
      { status: 503 },
    );
  }
}
