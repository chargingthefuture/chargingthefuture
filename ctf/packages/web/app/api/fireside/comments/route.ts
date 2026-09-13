import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureMutationCsrf, requireFiresideAuthor } from 'lib/fireside/_lib';
import {
  FIRESIDE_ERROR_CODE,
  FIRESIDE_HELD_NOTICE,
  FIRESIDE_MAX_COMMENTS_PER_DAY,
  FIRESIDE_MAX_COMMENT_LENGTH,
  FIRESIDE_MIN_COMMENT_LENGTH,
} from 'lib/fireside/constants';
import { createComment, insertFiresideAudit, type CommentRefusal } from 'lib/fireside/repository';
import { failureReason, failureResponse } from 'lib/errors/failure';

const bodySchema = z.object({
  postRepo: z.string().min(1).max(200),
  postSlug: z.string().min(1).max(400),
  postTitle: z.string().max(400).optional(),
  parentCommentId: z.string().uuid().nullable().optional(),
  body: z.string().min(1).max(FIRESIDE_MAX_COMMENT_LENGTH + 1),
});

// Every refusal names the thing the person would change. Rule 137: a sentence that only says no
// makes somebody guess, and guessing on a comment box means giving up.
const REFUSAL_MESSAGE: Record<CommentRefusal, { message: string; status: number }> = {
  body_too_short: {
    message: `Write at least ${FIRESIDE_MIN_COMMENT_LENGTH} characters.`,
    status: 400,
  },
  body_too_long: {
    message: `That is longer than ${FIRESIDE_MAX_COMMENT_LENGTH} characters. Shorten it, or say it across two comments.`,
    status: 400,
  },
  thread_closed: {
    message: 'This conversation is closed to new comments.',
    status: 409,
  },
  parent_not_found: {
    message: 'The comment you are replying to is no longer there.',
    status: 404,
  },
  reply_depth_exceeded: {
    message: 'Replies go one level deep. Reply to the comment above this one instead.',
    status: 400,
  },
  daily_limit_reached: {
    message: `That is ${FIRESIDE_MAX_COMMENTS_PER_DAY} comments in a day, which is the limit. Come back tomorrow.`,
    status: 429,
  },
};

// Read and check the body. Split out of POST so that function stays inside the complexity budget
// (rule 116) and so the two ways a request can be malformed sit together.
async function readCommentInput(
  request: Request,
): Promise<{ ok: true; data: z.infer<typeof bodySchema> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
        { status: 400 },
      ),
    };
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, message: 'A post reference and a comment body are required.' },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

// Record what happened and answer it. Split out of POST for the complexity budget (rule 116), and
// because the two outcomes read better side by side than buried in the middle of the handler.
async function answerCreated(
  outcome: Awaited<ReturnType<typeof createComment>>,
  actorId: string,
  postRepo: string,
  postSlug: string,
): Promise<NextResponse> {
  if (outcome.status === 'refused') {
    const refusal = REFUSAL_MESSAGE[outcome.reason];
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, reason: outcome.reason, message: refusal.message },
      { status: refusal.status },
    );
  }

  await insertFiresideAudit({
    actorId,
    command: 'fireside.comment.create',
    policyStatus: 'allow',
    reason: 'ok',
    targetType: 'comment',
    targetId: outcome.commentId,
    result: outcome.isPubliclyVisible ? 'published' : 'held_for_approval',
    metadata: { postRepo, postSlug },
  });

  // Said now rather than discovered later. A comment that saves and does not appear reads as
  // censorship or as a broken page, and both cost the person who wrote it.
  return NextResponse.json(
    {
      ok: true,
      commentId: outcome.commentId,
      isPubliclyVisible: outcome.isPubliclyVisible,
      notice: outcome.isPubliclyVisible ? null : FIRESIDE_HELD_NOTICE,
    },
    { status: 201 },
  );
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireFiresideAuthor();
  if (!gate.allowed) return gate.response;

  const parsed = await readCommentInput(request);
  if (!parsed.ok) return parsed.response;

  try {
    const outcome = await createComment(gate.auth.userId, gate.auth.username ?? '', {
      postRepo: parsed.data.postRepo,
      postSlug: parsed.data.postSlug,
      postTitle: parsed.data.postTitle ?? '',
      parentCommentId: parsed.data.parentCommentId ?? null,
      body: parsed.data.body,
    });
    return await answerCreated(outcome, gate.auth.userId, parsed.data.postRepo, parsed.data.postSlug);
  } catch (error) {
    return failureResponse({
      summary: 'Unable to post that comment',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'comment_create',
      status: 503,
      audience: gate.auth.isAdmin ? 'operator' : 'member',
    });
  }
}
