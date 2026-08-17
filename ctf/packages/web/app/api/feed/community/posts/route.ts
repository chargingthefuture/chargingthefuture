import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedReadAccess } from '../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { createFeedCommunityPost, validateFeedCommunityPostInput } from 'lib/feed/repository';
import type { FeedCommunityPostInput } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type CommunityBody = Partial<FeedCommunityPostInput>;

function parseBody(body: CommunityBody): FeedCommunityPostInput {
  return {
    body: typeof body.body === 'string' ? body.body : '',
    category: body.category,
    replyToPostId: typeof body.replyToPostId === 'string' ? body.replyToPostId : null,
  };
}

// Parse and validate the community post body. Returns the validated input or a ready-to-return error
// response.
async function parsePostBody(
  request: Request,
): Promise<{ error: NextResponse } | { data: FeedCommunityPostInput }> {
  let body: CommunityBody;
  try {
    body = (await request.json()) as CommunityBody;
  } catch (caught) {
    return {
      error: NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(caught) },
        { status: 400 },
      ),
    };
  }

  const input = parseBody(body);
  if (!validateFeedCommunityPostInput(input)) {
    return {
      error: NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid community post payload.' },
        { status: 400 },
      ),
    };
  }

  return { data: input };
}

// Map an error thrown while creating the post to its response. Preserves the status code and error
// code for each known failure, and reports anything unrecognized as a 503.
function mapPostError(error: unknown): NextResponse {
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

  if (code === 'reply_target_invalid' || code === 'reply_target_not_found') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'The post you are replying to is no longer available.' },
      { status: 400 },
    );
  }

  reportError(error, { area: 'feed', op: 'community_posts' });
  return NextResponse.json(
    { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to create community post.' },
    { status: 503 },
  );
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

  const parsed = await parsePostBody(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const input = parsed.data;

  try {
    const result = await createFeedCommunityPost(gate.auth.userId, input, gate.auth.username ?? null);
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
    return mapPostError(error);
  }
}
