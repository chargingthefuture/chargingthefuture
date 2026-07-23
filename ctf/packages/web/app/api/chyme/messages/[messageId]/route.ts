import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { logChymeAudit } from 'lib/chyme/audit';
import { deleteRoomMessage } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { requireChymeRoomAccess, ensureMutationCsrf } from '../../_lib';

// Delete the signed-in member's OWN Chyme room chat message. Author-only (the repository checks
// ownership). The product deliberately has no in-place edit — to change a message you delete it and
// post again — so the client's "Edit" loads the text back into the composer and calls this delete,
// then the member sends a fresh message (new id, new timestamp). Room-scoped via `?room=` like the
// sibling message routes. CSRF-guarded.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  const gate = await requireChymeRoomAccess(request);
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { messageId } = await context.params;
  if (!UUID_REGEX.test(messageId)) {
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.invalidPayload, message: 'Invalid message id.' },
      { status: 400 },
    );
  }

  try {
    await deleteRoomMessage(gate.identity, messageId, gate.roomKey);

    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.message.delete',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'author_delete',
      target: { roomKey: gate.roomKey, messageId },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, messageId }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error';

    if (code === 'message_not_found') {
      return NextResponse.json(
        { ok: false, code: CHYME_ERROR_CODE.messageNotFound, message: 'That message is no longer available.' },
        { status: 404 },
      );
    }

    if (code === 'not_message_owner') {
      logChymeAudit({
        pluginId: 'chyme',
        command: 'chyme.message.delete',
        actorId: gate.auth.userId,
        status: 'deny',
        reason: 'actor_not_message_owner',
        target: { roomKey: gate.roomKey, messageId },
        result: 'failure',
        errorCategory: 'authorization',
      });
      return NextResponse.json(
        { ok: false, code: CHYME_ERROR_CODE.notMessageOwner, message: 'You can only delete your own messages.' },
        { status: 403 },
      );
    }

    reportError(error, { area: 'chyme', op: 'message_delete', extra: { userId: gate.auth.userId } });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.message.delete',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'author_delete',
      target: { roomKey: gate.roomKey, messageId },
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete message.' },
      { status: 503 },
    );
  }
}
