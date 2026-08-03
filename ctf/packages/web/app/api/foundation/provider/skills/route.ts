import { NextResponse } from 'next/server';
import { requireFoundationReadAccess, ensureMutationCsrf } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { listOwnOfferableSkills, setOwnOfferedSkills } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The skills the member could offer through Foundation (their own Directory skills), each flagged
// with whether they have currently opted in to be contacted about it.
export async function GET() {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const skills = await listOwnOfferableSkills(gate.auth.userId);
    return NextResponse.json({ ok: true, skills }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'provider_skills_list' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to load your offered skills.' },
      { status: 503 },
    );
  }
}

// Replace the member's set of offered skills. Only skills they actually list on their own claimed
// Directory profile are accepted; the server returns the accepted set.
export async function PUT(request: Request) {
  // CSRF first, then auth — the canonical mutation order across this plugin (e.g. connections/threads),
  // so a cross-origin request is bounced before it reaches the auth subsystem (issue #989).
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: { skillIds?: unknown };
  try {
    body = (await request.json()) as { skillIds?: unknown };
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.skillIds) || !body.skillIds.every((id) => typeof id === 'string')) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'skillIds must be an array of strings.' },
      { status: 400 },
    );
  }

  try {
    const accepted = await setOwnOfferedSkills(gate.auth.userId, body.skillIds as string[]);
    return NextResponse.json({ ok: true, offeredSkillIds: accepted }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'provider_skills_set' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to save your offered skills.' },
      { status: 503 },
    );
  }
}
