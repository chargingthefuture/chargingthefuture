import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntModeratorAccess } from '../../../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { generateDirectoryProfileFromAcceptedSubmission, insertSkillsHuntAudit } from 'lib/skills-hunt/repository';
import { reportError } from 'lib/observability/report';

type GenerateBody = {
  invitedByUsername?: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const gate = await requireSkillsHuntModeratorAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { submissionId } = await params;

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const invitedByUsername = typeof body.invitedByUsername === 'string'
    ? body.invitedByUsername.trim()
    : gate.auth.username ?? '';

  if (invitedByUsername.length === 0) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'invitedByUsername is required.' },
      { status: 400 },
    );
  }

  try {
    const generated = await generateDirectoryProfileFromAcceptedSubmission(gate.auth.userId, submissionId, invitedByUsername);

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.directory-profile.generate',
      policyStatus: 'allow',
      reason: 'moderator_or_admin_route_guard',
      targetType: 'submission',
      targetId: submissionId,
      metadata: { generatedProfileId: generated.generatedProfileId },
    });

    return NextResponse.json({ ok: true, generated }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_submissions_submissionid_generate_directory_profile' });
    const message = error instanceof Error ? error.message : 'unknown';

    let status = 503;
    let code: string = SKILLS_HUNT_ERROR_CODE.persistenceUnavailable;
    let responseMessage = 'Unable to generate directory profile projection.';

    if (message === 'skills_hunt_profile_already_generated') {
      status = 409;
      code = SKILLS_HUNT_ERROR_CODE.profileAlreadyGenerated;
      responseMessage = 'Directory profile was already generated for this submission.';
    } else if (message === 'skills_hunt_submission_not_found') {
      status = 404;
      code = SKILLS_HUNT_ERROR_CODE.submissionNotFound;
      responseMessage = 'Accepted submission not found.';
    }

    return NextResponse.json({ ok: false, code, message: responseMessage }, { status });
  }
}
