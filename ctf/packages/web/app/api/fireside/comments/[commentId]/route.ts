import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureMutationCsrf, requireFiresideAuthor } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { setExportPreference } from 'lib/fireside/export-review';
import { insertFiresideAudit, withdrawOwnComment } from 'lib/fireside/repository';
import { failureReason, failureResponse } from 'lib/errors/failure';

type RouteProps = { params: Promise<{ commentId: string }> };

/**
 * Turn a refusal from the export-request write into the answer the author reads. Split out of PATCH
 * so that handler stays inside the complexity budget (rule 116), and because the two ways a request
 * can be turned down read better side by side than spread through the handler.
 */
function refuseExportChange(outcome: 'already_refused' | 'not_found'): NextResponse {
  if (outcome === 'not_found') {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.notFound, message: 'No live comment of yours with that id.' },
      { status: 404 },
    );
  }
  // Said plainly rather than silently ignored. The author is owed the reason their switch does
  // nothing, and a refusal that can be re-queued by toggling is not a refusal.
  return NextResponse.json(
    {
      ok: false,
      code: FIRESIDE_ERROR_CODE.exportRefused,
      message:
        'An admin already declined this one for the blog. Your comment stays in the conversation here; it is not being copied out.',
    },
    { status: 409 },
  );
}

const patchSchema = z.object({ exportToBlog: z.boolean() });

/**
 * The author takes their own comment down. Always available, approved or not, and it is the same
 * right the account area already gives over everything else a member has written here.
 */
export async function DELETE(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireFiresideAuthor();
  if (!gate.allowed) return gate.response;

  const { commentId } = await params;

  try {
    const done = await withdrawOwnComment(gate.auth.userId, commentId);
    if (!done) {
      return NextResponse.json(
        { ok: false, code: FIRESIDE_ERROR_CODE.notFound, message: 'No comment of yours with that id, or it is already withdrawn.' },
        { status: 404 },
      );
    }
    await insertFiresideAudit({
      actorId: gate.auth.userId,
      command: 'fireside.comment.withdraw',
      policyStatus: 'allow',
      reason: 'author_request',
      targetType: 'comment',
      targetId: commentId,
      result: 'withdrawn',
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: 'Unable to withdraw that comment',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'comment_withdraw',
      status: 503,
      audience: gate.auth.isAdmin ? 'operator' : 'member',
    });
  }
}

/**
 * The author asks for this comment to be copied into the blog's own published build, where it
 * becomes searchable and is captured by the Internet Archive — or takes the ask back.
 *
 * Off unless the author turns it on. The words are theirs, so permanence is their call, and a web
 * capture cannot be withdrawn afterwards by anybody, this project included.
 *
 * Turning it on queues the request rather than granting it: an admin has to agree as well, because
 * the build is a public page beside the project's own writing and an account posting spam or bait
 * would otherwise put its text there permanently. Turning it off always works, approved or not.
 */
export async function PATCH(request: Request, { params }: RouteProps) {
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

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, message: 'Send exportToBlog as true or false.' },
      { status: 400 },
    );
  }

  try {
    const outcome = await setExportPreference(gate.auth.userId, commentId, parsed.data.exportToBlog);
    if (outcome !== 'saved') return refuseExportChange(outcome);

    await insertFiresideAudit({
      actorId: gate.auth.userId,
      command: 'fireside.comment.set_export',
      policyStatus: 'allow',
      reason: 'author_choice',
      targetType: 'comment',
      targetId: commentId,
      result: parsed.data.exportToBlog ? 'export_requested' : 'export_withdrawn',
    });
    return NextResponse.json(
      {
        ok: true,
        exportToBlog: parsed.data.exportToBlog,
        exportReview: parsed.data.exportToBlog ? 'pending' : 'not_requested',
      },
      { status: 200 },
    );
  } catch (error) {
    return failureResponse({
      summary: 'Unable to change that setting',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'comment_set_export',
      status: 503,
      audience: gate.auth.isAdmin ? 'operator' : 'member',
    });
  }
}
