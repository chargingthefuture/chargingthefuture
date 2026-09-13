import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureMutationCsrf, requireFiresideAuthor } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE, FIRESIDE_REACTION_KINDS } from 'lib/fireside/constants';
import { insertFiresideAudit, toggleReaction } from 'lib/fireside/repository';
import { failureReason, failureResponse } from 'lib/errors/failure';

type RouteProps = { params: Promise<{ commentId: string }> };

const bodySchema = z.object({ kind: z.enum(FIRESIDE_REACTION_KINDS) });

/**
 * Leave or take back a reaction. Signing in is enough to press it; whether it counts in public
 * follows the same rule as a comment, because a reaction from an unverified account is how a
 * brigade would work. Approving the person makes everything they have left count at once.
 */
export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireFiresideAuthor();
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
      {
        ok: false,
        code: FIRESIDE_ERROR_CODE.invalidPayload,
        message: `Pick one of: ${FIRESIDE_REACTION_KINDS.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  try {
    const outcome = await toggleReaction(gate.auth.userId, commentId, parsed.data.kind);
    if (outcome === 'not_found') {
      return NextResponse.json(
        { ok: false, code: FIRESIDE_ERROR_CODE.notFound, message: 'That comment is no longer there.' },
        { status: 404 },
      );
    }
    await insertFiresideAudit({
      actorId: gate.auth.userId,
      command: 'fireside.reaction.toggle',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'comment',
      targetId: commentId,
      result: outcome,
      metadata: { kind: parsed.data.kind },
    });
    return NextResponse.json({ ok: true, outcome }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: 'Unable to record that reaction',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'reaction_toggle',
      status: 503,
      audience: gate.auth.isAdmin ? 'operator' : 'member',
    });
  }
}
