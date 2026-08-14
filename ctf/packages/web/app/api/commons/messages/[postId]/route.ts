import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { deleteCommunityPost, normalizeUuid } from 'lib/feed/repository';
import { requireCommonsAccess } from '../../_lib';
import { ensureMutationCsrf } from '../../../feed/_lib';

// Delete the signed-in member's own Commons community (peer) post. Author-only: the repository
// checks ownership, so a member can only delete their own post. The product deliberately has no
// edit — to change a post you delete it and post again, so a corrected message is a fresh row with
// its own moderation and no inherited reactions/replies.

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
