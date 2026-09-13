import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureMutationCsrf, requireFiresideAuthor } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { insertFiresideAudit, setExportPreference, withdrawOwnComment } from 'lib/fireside/repository';
import { failureReason, failureResponse } from 'lib/errors/failure';

type RouteProps = { params: Promise<{ commentId: string }> };

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
 * Whether this comment may be copied into the blog's own published build, where it becomes
 * searchable and is captured by the Internet Archive.
 *
 * Off unless the author turns it on. The words are theirs, so permanence is their call — and a web
 * capture cannot be withdrawn afterwards by anybody, this project included.
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
    const done = await setExportPreference(gate.auth.userId, commentId, parsed.data.exportToBlog);
    if (!done) {
      return NextResponse.json(
        { ok: false, code: FIRESIDE_ERROR_CODE.notFound, message: 'No live comment of yours with that id.' },
        { status: 404 },
      );
    }
    await insertFiresideAudit({
      actorId: gate.auth.userId,
      command: 'fireside.comment.set_export',
      policyStatus: 'allow',
      reason: 'author_choice',
      targetType: 'comment',
      targetId: commentId,
      result: parsed.data.exportToBlog ? 'export_on' : 'export_off',
    });
    return NextResponse.json({ ok: true, exportToBlog: parsed.data.exportToBlog }, { status: 200 });
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
