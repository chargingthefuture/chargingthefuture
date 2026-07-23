import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingReadAccess } from 'lib/peer-programming/_lib';
import { createMessage, insertPeerProgrammingAudit, isCohortEnded, isCohortMember } from 'lib/peer-programming/repository';
import { PEER_PROGRAMMING_ERROR_CODE, PEER_PROGRAMMING_MAX_MESSAGE_LENGTH } from 'lib/peer-programming/constants';
import { reportError } from 'lib/observability/report';

type CreateMessageBody = {
  cohortId?: string;
  body?: string;
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: CreateMessageBody;
  try {
    body = (await request.json()) as CreateMessageBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.cohortId || !body.body) {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_payload', message: 'cohortId and body are required.' }, { status: 400 });
  }

  if (body.body.length > PEER_PROGRAMMING_MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { ok: false, code: 'peer_programming_invalid_payload', message: `Message body must be ${PEER_PROGRAMMING_MAX_MESSAGE_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  // Only a member of the cohort may post into it. The tier is decided here from that
  // membership, never trusted from the request body — an authenticated non-member
  // cannot post or label themselves as a cohort member.
  const isMember = await isCohortMember(body.cohortId, gate.auth.userId);
  if (!isMember) {
    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.thread.post.create',
      policyStatus: 'deny',
      reason: 'not_cohort_member',
      targetType: 'cohort',
      targetId: body.cohortId,
    });
    return NextResponse.json(
      { ok: false, code: 'peer_programming_policy_denied', message: 'Only cohort members can post in this cohort.' },
      { status: 403 },
    );
  }

  // An ended cohort's Direct Line is read-only. Reject posting even from a member — closes the
  // "post into a closed cohort via a leftover link" hole once weekly cohorts start being ended.
  if (await isCohortEnded(body.cohortId)) {
    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.thread.post.create',
      policyStatus: 'deny',
      reason: 'cohort_ended',
      targetType: 'cohort',
      targetId: body.cohortId,
    });
    return NextResponse.json(
      { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.cohortEnded, message: 'This cohort has ended and is read-only.' },
      { status: 409 },
    );
  }

  try {
    const message = await createMessage({
      cohortId: body.cohortId,
      authorUserId: gate.auth.userId,
      body: body.body,
      tier: 'cohort_member',
    });

    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.thread.post.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'message',
      targetId: message.id,
    });

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'messages' });
    return peerProgrammingErrorResponse(error, 'Message creation unavailable.');
  }
}
