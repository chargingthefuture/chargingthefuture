import { NextResponse } from 'next/server';
import { createMessage, insertPeerProgrammingAudit } from 'lib/peer-programming/repository';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingReadAccess } from 'lib/peer-programming/_lib';
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

  const { messageId } = await context.params;

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
