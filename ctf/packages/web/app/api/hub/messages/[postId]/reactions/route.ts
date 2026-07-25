import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { FEED_ERROR_CODE, isAllowedFeedReactionEmoji } from 'lib/feed/constants';
import { normalizeUuid, toggleCommunityPostReaction } from 'lib/feed/repository';
import { requireHubAccess } from '../../../_lib';
import { ensureMutationCsrf } from '../../../../feed/_lib';

// Toggle the signed-in member's emoji reaction on a Hub community (peer) post. Reactions live
// in our own database (feed_community_post_reactions), not in Stream. A second tap of the same
// emoji removes it. The emoji must be in the fixed quick set; anything else is rejected (400).

type ReactionRequestBody = {
  emoji?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { postId: rawPostId } = await context.params;
  // Reject a malformed id (community post ids are UUIDs) before it reaches the repository.
  const postId = normalizeUuid(rawPostId);
  if (!postId) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid post id.' },
      { status: 400 },
    );
  }

  let body: ReactionRequestBody;
  try {
    body = (await request.json()) as ReactionRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const emoji = typeof body.emoji === 'string' ? body.emoji : '';
  if (!isAllowedFeedReactionEmoji(emoji)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Unsupported reaction emoji.' },
      { status: 400 },
    );
  }

  try {
    const result = await toggleCommunityPostReaction(gate.auth.userId, postId, emoji);
    return NextResponse.json({ ok: true, reacted: result.reacted }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error';
    if (code === 'reaction_emoji_invalid') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Unsupported reaction emoji.' },
        { status: 400 },
      );
    }
    if (code === 'post_not_found') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.postNotFound, message: 'The post you are reacting to is no longer available.' },
        { status: 400 },
      );
    }
    if (code === 'cannot_react_to_own_post') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.forbidden, message: 'You can’t react to your own post.' },
        { status: 403 },
      );
    }

    // Unexpected failure (e.g. a database error): caught errors do not reach Sentry on their
    // own, so report it. The client still gets a generic message.
    Sentry.captureException(error, { tags: { area: 'hub', op: 'toggle_reaction' } });
    return NextResponse.json(
      { ok: false, message: 'Unable to update your reaction.' },
      { status: 503 },
    );
  }
}
