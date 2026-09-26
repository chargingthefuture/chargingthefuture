import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';
import { FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH, FEED_ERROR_CODE, FEED_MAX_COMMUNITY_POST_LENGTH } from 'lib/feed/constants';
import { feedPostLength } from 'lib/feed/normalize';
import { logFeedAudit } from 'lib/feed/audit';
import {
  deleteCommunityPost,
  editCommunityPost,
  normalizeUuid,
  validateFeedCommunityPostInput,
} from 'lib/feed/repository';
import { requireCommonsAccess } from '../../_lib';
import { ensureMutationCsrf } from '../../../feed/_lib';
import { failureReason } from 'lib/errors/failure';

// Delete the signed-in member's own Commons community (peer) post. Author-only: the repository
// checks ownership, so a member can only delete their own post. The product deliberately has no
// edit — to change a post you delete it and post again, so a corrected message is a fresh row with
// its own moderation and no inherited reactions/replies. The one exception is PATCH below, for a
// post that carries a picture.

export async function DELETE(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const gate = await requireCommonsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { postId: rawPostId } = await context.params;
  // Reject a malformed id (community post ids are UUIDs) before it reaches the repository, so an
  // arbitrarily long or malformed path segment cannot waste a database round-trip.
  const postId = normalizeUuid(rawPostId);
  if (!postId) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid post id.' },
      { status: 400 },
    );
  }

  try {
    await deleteCommunityPost(gate.auth.userId, postId);

    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.community.post.delete',
      status: 'allow',
      reason: 'author_delete',
      targetType: 'feed_community_post',
      targetId: postId,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, postId }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error';
    if (code === 'post_not_found') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.postNotFound, message: 'That post is no longer available.' },
        { status: 404 },
      );
    }
    if (code === 'not_post_owner') {
      // Only the author can delete their own post. Log the denied attempt for accountability.
      logFeedAudit({
        actorId: gate.auth.userId,
        pluginId: 'feed',
        command: 'feed.community.post.delete',
        status: 'deny',
        reason: 'actor_not_post_owner',
        targetType: 'feed_community_post',
        targetId: postId,
        result: 'failure',
        errorCategory: 'authorization',
      });
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.forbidden, message: 'You can only delete your own posts.' },
        { status: 403 },
      );
    }

    // Unexpected failure (e.g. a database error): caught errors do not reach Sentry on their own,
    // so report it. The client still gets a generic message.
    reportError(error, { area: 'commons', op: 'delete_post' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete your post.' },
      { status: 503 },
    );
  }
}

type EditPostRequestBody = { text?: unknown };

// Parse and validate the PATCH body, against the same length/URL caps a fresh post uses. Returns a
// 400 response when the text is missing or over the cap, naming the overage the same way the POST
// route's validateCommonsPostInput does.
function validateEditPostInput(
  body: EditPostRequestBody,
  isPrivileged: boolean,
): { error: NextResponse } | { text: string } {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const maxLength = isPrivileged ? FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH : FEED_MAX_COMMUNITY_POST_LENGTH;
  if (!text || !validateFeedCommunityPostInput({ body: text, replyToPostId: null }, maxLength)) {
    const overBy = feedPostLength(text) - maxLength;
    return {
      error: NextResponse.json(
        {
          ok: false,
          message:
            overBy > 0
              ? `That message is ${overBy.toLocaleString()} characters over the ${maxLength.toLocaleString()}-character limit. Shorten it, or split it into two messages.`
              : 'Message text must be a valid community post.',
        },
        { status: 400 },
      ),
    };
  }
  return { text };
}

// Map an editCommunityPost failure to its response, logging the denied attempt when ownership was
// the reason (accountability, matching the DELETE handler above).
function mapEditPostError(error: unknown, actorId: string, postId: string): NextResponse {
  const code = error instanceof Error ? error.message : 'unknown_error';
  if (code === 'post_not_found') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.postNotFound, message: 'That post is no longer available.' },
      { status: 404 },
    );
  }
  if (code === 'not_post_owner') {
    logFeedAudit({
      actorId,
      pluginId: 'feed',
      command: 'feed.community.post.edit',
      status: 'deny',
      reason: 'actor_not_post_owner',
      targetType: 'feed_community_post',
      targetId: postId,
      result: 'failure',
      errorCategory: 'authorization',
    });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.forbidden, message: 'You can only edit your own posts.' },
      { status: 403 },
    );
  }
  if (code === 'post_hidden') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.forbidden, message: 'A post a moderator has hidden cannot be edited.' },
      { status: 403 },
    );
  }
  if (code === 'edit_requires_image') {
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.forbidden,
        message: 'Only a post with a picture can be edited in place. Delete and post again instead.',
      },
      { status: 403 },
    );
  }
  if (code === 'content_policy_violation') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.moderationRejected, message: 'Post blocked by content moderation.' },
      { status: 422 },
    );
  }

  reportError(error, { area: 'commons', op: 'edit_post' });
  return NextResponse.json(
    { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to save your edit.' },
    { status: 503 },
  );
}

// Rewrite the text of the signed-in member's own Commons picture post in place — the picture, its
// reactions, and its replies all stay. Restricted server-side (see editCommunityPost) to a post that
// carries a picture: those are always admin-authored, since members cannot attach one, so there is no
// bait-and-switch risk in letting the text change without a fresh moderation row. A text-only peer
// post has no PATCH path; it keeps the DELETE-then-repost flow above.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const gate = await requireCommonsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { postId: rawPostId } = await context.params;
  const postId = normalizeUuid(rawPostId);
  if (!postId) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid post id.' },
      { status: 400 },
    );
  }

  let body: EditPostRequestBody;
  try {
    body = (await request.json()) as EditPostRequestBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'Invalid JSON payload.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const isPrivileged = gate.auth.isAdmin;
  const validated = validateEditPostInput(body, isPrivileged);
  if ('error' in validated) {
    return validated.error;
  }

  try {
    const result = await editCommunityPost(gate.auth.userId, postId, validated.text, isPrivileged);

    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.community.post.edit',
      status: 'allow',
      reason: 'author_edit',
      targetType: 'feed_community_post',
      targetId: postId,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, postId, body: result.body, editedAtIso: result.editedAtIso }, { status: 200 });
  } catch (error) {
    return mapEditPostError(error, gate.auth.userId, postId);
  }
}
