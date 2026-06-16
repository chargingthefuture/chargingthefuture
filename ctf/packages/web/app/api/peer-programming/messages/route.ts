import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingReadAccess } from 'lib/peer-programming/_lib';
import { createMessage, insertPeerProgrammingAudit, isCohortMember } from 'lib/peer-programming/repository';
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
