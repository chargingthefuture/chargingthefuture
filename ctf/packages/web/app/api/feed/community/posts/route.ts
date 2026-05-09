import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedReadAccess } from '../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { createFeedCommunityPost, validateFeedCommunityPostInput } from 'lib/feed/repository';
import type { FeedCommunityPostInput } from 'lib/feed/types';

type CommunityBody = Partial<FeedCommunityPostInput>;

function parseBody(body: CommunityBody): FeedCommunityPostInput {
  return {
    body: typeof body.body === 'string' ? body.body : '',
    category: body.category,
  };
}

export async function POST(request: Request) {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: CommunityBody;
  try {
    body = (await request.json()) as CommunityBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseBody(body);
  if (!validateFeedCommunityPostInput(input)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid community post payload.' },
      { status: 400 },
    );
  }

  try {
    const result = await createFeedCommunityPost(gate.auth.userId, input);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.community.post.create',
      status: 'allow',
      reason: 'community_post_allowed',
      targetType: 'feed_community_post',
      targetId: result.postId,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, postId: result.postId, createdAt: result.createdAtIso, status: 'published' }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error';
    if (code === 'rate_limit_exceeded') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.rateLimitExceeded, message: 'Community posting rate limit exceeded.' },
        { status: 429 },
      );
    }

    if (code === 'content_policy_violation') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.moderationRejected, message: 'Community post blocked by content moderation.' },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to create community post.' },
      { status: 503 },
    );
  }
}
