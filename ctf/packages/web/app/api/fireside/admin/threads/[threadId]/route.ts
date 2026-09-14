import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureMutationCsrf, requireFiresideAdmin } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { insertFiresideAudit, setThreadClosed } from 'lib/fireside/repository';
import { failureReason, failureResponse } from 'lib/errors/failure';

type RouteProps = { params: Promise<{ threadId: string }> };

const bodySchema = z.object({
  isClosed: z.boolean(),
  reason: z.string().max(500).default(''),
});

/**
 * Close a conversation to new comments, or open it again.
 *
 * Deliberately not a removal. Everything already written stays exactly where it is and stays
 * readable by anybody — closing says the talking is done, not that the talk was wrong. A thread
 * that needed erasing is a moderation question about its comments, answered one at a time by
 * /api/fireside/admin/comments/[commentId], and conflating the two would let one decision quietly
 * do the other's work.
 *
 * Reversible on purpose, and the same route in both directions: a conversation closed early can be
 * opened again by the person who closed it, without anybody having to touch the database.
 */
export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireFiresideAdmin();
  if (!gate.allowed) return gate.response;

  const { threadId } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: FIRESIDE_ERROR_CODE.invalidPayload,
        message: 'Send isClosed as true to close this conversation to new comments, or false to open it again.',
      },
      { status: 400 },
    );
  }

  try {
    const done = await setThreadClosed(threadId, parsed.data.isClosed);
    if (!done) {
      return NextResponse.json(
        {
          ok: false,
          code: FIRESIDE_ERROR_CODE.notFound,
          message: 'No conversation with that id. A thread exists once somebody has commented under the post.',
        },
        { status: 404 },
      );
    }
    await insertFiresideAudit({
      actorId: gate.auth.userId,
      command: parsed.data.isClosed ? 'fireside.thread.close' : 'fireside.thread.reopen',
      policyStatus: 'allow',
      reason: parsed.data.reason || 'moderation',
      targetType: 'thread',
      targetId: threadId,
      result: parsed.data.isClosed ? 'closed' : 'reopened',
    });
    return NextResponse.json({ ok: true, isClosed: parsed.data.isClosed }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: 'Unable to change whether that conversation is open',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'thread_set_closed',
      status: 503,
      audience: 'operator',
    });
  }
}
