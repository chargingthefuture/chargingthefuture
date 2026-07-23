import { NextResponse } from 'next/server';
import { createMessage, getMessageById, insertPeerProgrammingAudit, isCohortEnded, isCohortMember } from 'lib/peer-programming/repository';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingReadAccess } from 'lib/peer-programming/_lib';
import { PEER_PROGRAMMING_ERROR_CODE, PEER_PROGRAMMING_MAX_MESSAGE_LENGTH } from 'lib/peer-programming/constants';
import { reportError } from 'lib/observability/report';

type ReplyBody = {
  cohortId?: string;
  body?: string;
};



export async function POST(request: Request, context: { params: Promise<{ messageId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: ReplyBody;
  try {
    body = (await request.json()) as ReplyBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.cohortId || !body.body) {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_payload', message: 'cohortId and body are required.' }, { status: 400 });
  }

  if (body.body.length > PEER_PROGRAMMING_MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { ok: false, code: 'peer_programming_invalid_payload', message: `Reply body must be ${PEER_PROGRAMMING_MAX_MESSAGE_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  const { messageId } = await context.params;

  // Only a member of the cohort may reply in it (see the post route for the same rule).
  const isMember = await isCohortMember(body.cohortId, gate.auth.userId);
  if (!isMember) {
    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.thread.reply.create',
      policyStatus: 'deny',
      reason: 'not_cohort_member',
      targetType: 'cohort',
      targetId: body.cohortId,
      metadata: { parentMessageId: messageId },
    });
    return NextResponse.json(
      { ok: false, code: 'peer_programming_policy_denied', message: 'Only cohort members can reply in this cohort.' },
      { status: 403 },
    );
  }

  // An ended cohort's Direct Line is read-only — reject replies too (same rule as the post route).
  if (await isCohortEnded(body.cohortId)) {
    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.thread.reply.create',
      policyStatus: 'deny',
      reason: 'cohort_ended',
      targetType: 'cohort',
      targetId: body.cohortId,
      metadata: { parentMessageId: messageId },
    });
    return NextResponse.json(
      { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.cohortEnded, message: 'This cohort has ended and is read-only.' },
      { status: 409 },
    );
  }

  // The parent must exist and live in the same cohort — the contract's parentThreadRequired
  // rule. Without this a member could attach a reply to a fabricated id (an orphan row) or to
  // a message in another cohort. Checked after membership so a non-member always gets the same
  // 403 and cannot probe which message ids exist. Cross-cohort ids and unknown ids both return
  // the same 404, so a member cannot probe other cohorts' ids either.
  const parent = await getMessageById(messageId);
  if (!parent || parent.cohortId !== body.cohortId) {
    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.thread.reply.create',
      policyStatus: 'deny',
      reason: 'thread_not_found',
      targetType: 'message',
      targetId: messageId,
      metadata: { cohortId: body.cohortId },
    });
    return NextResponse.json(
      { ok: false, code: 'peer_programming_thread_not_found', message: 'The message you are replying to does not exist in this cohort.' },
      { status: 404 },
    );
  }

  try {
    const reply = await createMessage({
      cohortId: body.cohortId,
      authorUserId: gate.auth.userId,
      body: body.body,
      parentMessageId: messageId,
      tier: 'cohort_member',
    });

    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.thread.reply.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'message',
      targetId: reply.id,
      metadata: { parentMessageId: messageId },
    });

    return NextResponse.json({ ok: true, reply }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'messages_messageid_replies' });
    return peerProgrammingErrorResponse(error, 'Reply creation unavailable.');
  }
}
