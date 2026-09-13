import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureMutationCsrf, requireFiresideAdmin } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { insertFiresideAudit, moderateComment } from 'lib/fireside/repository';
import { failureReason, failureResponse } from 'lib/errors/failure';

type RouteProps = { params: Promise<{ commentId: string }> };

const bodySchema = z.object({
  action: z.enum(['remove', 'restore']),
  reason: z.string().max(500).default(''),
});

/**
 * Moderation. Separate from whether the author is approved, on purpose: approving somebody must
 * never resurrect a comment an admin took down, and a removal must not read to the author as a
 * verification problem. Removing also clears the blog-export flag, so nothing on its way out of the
 * app carries a removed comment with it.
 */
export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireFiresideAdmin();
  if (!gate.allowed) return gate.response;

  const { commentId } = await params;

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
      { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, message: 'Send an action of remove or restore.' },
      { status: 400 },
    );
  }

  try {
    const done = await moderateComment({
      adminId: gate.auth.userId,
      commentId,
      action: parsed.data.action,
      reason: parsed.data.reason,
    });
    if (!done) {
      return NextResponse.json(
        {
          ok: false,
          code: FIRESIDE_ERROR_CODE.notFound,
          message: parsed.data.action === 'remove'
            ? 'No live comment with that id — it may already be removed or withdrawn.'
            : 'No removed comment with that id.',
        },
        { status: 404 },
      );
    }
    await insertFiresideAudit({
      actorId: gate.auth.userId,
      command: `fireside.comment.${parsed.data.action}`,
      policyStatus: 'allow',
      reason: parsed.data.reason || 'moderation',
      targetType: 'comment',
      targetId: commentId,
      result: parsed.data.action === 'remove' ? 'removed' : 'restored',
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: 'Unable to moderate that comment',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'comment_moderate',
      status: 503,
      audience: 'operator',
    });
  }
}
