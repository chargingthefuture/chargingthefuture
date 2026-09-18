import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureMutationCsrf, requireFiresideAuthor } from 'lib/fireside/_lib';
import {
  FIRESIDE_EDIT_REQUEUE_NOTICE,
  FIRESIDE_ERROR_CODE,
  FIRESIDE_MAX_COMMENT_LENGTH,
  FIRESIDE_MIN_COMMENT_LENGTH,
} from 'lib/fireside/constants';
import { setExportPreference } from 'lib/fireside/export-review';
import {
  editOwnComment,
  insertFiresideAudit,
  withdrawOwnComment,
  type EditRefusalReason,
} from 'lib/fireside/repository';
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

// One route, two things an author does to their own comment: rewrite the words, or change whether
// they are asking for it to go on the blog. A union rather than one loose object, so a request that
// carries neither is refused instead of quietly doing nothing.
const patchSchema = z.union([
  z.object({ exportToBlog: z.boolean() }),
  z.object({ body: z.string().min(1).max(FIRESIDE_MAX_COMMENT_LENGTH + 1) }),
]);

// Every refusal names the thing the author would change (rule 137). Three of them are somebody
// else's decision that an edit does not get to reverse, and each says whose it is and what is still
// possible, because a sentence that only says no leaves a person guessing at a comment box.
const EDIT_REFUSAL: Record<EditRefusalReason, { message: string; status: number; code: string }> = {
  body_too_short: {
    message: `Write at least ${FIRESIDE_MIN_COMMENT_LENGTH} characters.`,
    status: 400,
    code: FIRESIDE_ERROR_CODE.invalidPayload,
  },
  body_too_long: {
    message: `That is longer than ${FIRESIDE_MAX_COMMENT_LENGTH} characters. Shorten it, or say the rest in a reply.`,
    status: 400,
    code: FIRESIDE_ERROR_CODE.invalidPayload,
  },
  removed_by_admin: {
    message: 'An admin took this comment down, so it cannot be rewritten. Putting it back is theirs to do.',
    status: 403,
    code: FIRESIDE_ERROR_CODE.forbidden,
  },
  withdrawn: {
    message: 'You took this comment down, and that cannot be undone. Write a new comment instead.',
    status: 403,
    code: FIRESIDE_ERROR_CODE.forbidden,
  },
  thread_closed: {
    message: 'This conversation is closed, so comments in it can no longer be changed. You can still take yours down.',
    status: 409,
    code: FIRESIDE_ERROR_CODE.threadClosed,
  },
};

/**
 * The author rewrites their own comment.
 *
 * The same edit the Commons has: the author, any time, with no window to beat, and the new words
 * checked the way the first ones were. The row keeps its id, so the replies under it and the
 * reactions on it stay where they are — which taking the comment down and writing it again does
 * not, and that was the only way to fix a typo before this (owner report, 2026-09-17).
 */
async function editComment(
  actorId: string,
  commentId: string,
  body: string,
  audience: 'operator' | 'member',
): Promise<NextResponse> {
  try {
    const outcome = await editOwnComment(actorId, commentId, body);
    if (outcome.status === 'not_found') {
      return NextResponse.json(
        { ok: false, code: FIRESIDE_ERROR_CODE.notFound, message: 'No comment of yours with that id.' },
        { status: 404 },
      );
    }
    if (outcome.status === 'refused') {
      const refusal = EDIT_REFUSAL[outcome.reason];
      return NextResponse.json(
        { ok: false, code: refusal.code, reason: outcome.reason, message: refusal.message },
        { status: refusal.status },
      );
    }

    await insertFiresideAudit({
      actorId,
      command: 'fireside.comment.edit',
      policyStatus: 'allow',
      reason: 'author_edit',
      targetType: 'comment',
      targetId: commentId,
      result: outcome.exportRequeued ? 'edited_export_requeued' : 'edited',
    });

    // Said now rather than discovered later: an author who had an approval and no longer has one is
    // owed the reason at the moment it changes.
    return NextResponse.json(
      {
        ok: true,
        commentId,
        editedAt: outcome.editedAt,
        exportRequeued: outcome.exportRequeued,
        notice: outcome.exportRequeued ? FIRESIDE_EDIT_REQUEUE_NOTICE : null,
      },
      { status: 200 },
    );
  } catch (error) {
    return failureResponse({
      summary: 'Unable to save that change',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'comment_edit',
      status: 503,
      audience,
    });
  }
}

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
 * What the author does to their own comment, short of taking it down: rewrite the words, or ask for
 * it to be copied into the blog's own published build — where it becomes searchable and is captured
 * by the Internet Archive — or take that ask back.
 *
 * A body rewrites; see editComment above for the edit policy, which is the Commons one.
 *
 * The export ask is off unless the author turns it on. The words are theirs, so permanence is their call, and a web
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
      {
        ok: false,
        code: FIRESIDE_ERROR_CODE.invalidPayload,
        message: 'Send body as the new text of the comment, or exportToBlog as true or false.',
      },
      { status: 400 },
    );
  }

  const audience = gate.auth.isAdmin ? 'operator' : 'member';
  if ('body' in parsed.data) {
    return editComment(gate.auth.userId, commentId, parsed.data.body, audience);
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
