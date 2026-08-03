import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedReadAccess } from '../../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { replyToFeedCommunityPost, validateFeedCommunityReplyBody } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type ReplyBody = {
  body?: string;
};

type RouteParams = {
  params: Promise<{
    postId: string;
  }>;
};

// Parse and validate the reply body. Returns the reply text to persist or a ready-to-return error
// response.
async function parseReplyBody(
  request: Request,
): Promise<{ error: NextResponse } | { data: string }> {
  let body: ReplyBody;
  try {
    body = (await request.json()) as ReplyBody;
  } catch (caught) {
    return {
      error: NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(caught) },
        { status: 400 },
      ),
    };
  }

  if (!validateFeedCommunityReplyBody(typeof body.body === 'string' ? body.body : '')) {
    return {
      error: NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid community reply payload.' },
        { status: 400 },
      ),
    };
  }

  return { data: body.body ?? '' };
}

// Map an error thrown while creating the reply to its response. Preserves the status code and error
// code for each known failure, and reports anything unrecognized as a 503.
function mapReplyError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : 'unknown_error';

  if (code === 'post_not_found') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.postNotFound, message: 'Community post not found.' },
      { status: 404 },
    );
  }

  if (code === 'content_policy_violation') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.moderationRejected, message: 'Community reply blocked by content moderation.' },
      { status: 422 },
    );
  }

  if (code === 'rate_limit_exceeded') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.rateLimitExceeded, message: 'Community reply rate limit exceeded.' },
      { status: 429 },
    );
  }

  reportError(error, { area: 'feed', op: 'community_posts_postid_reply' });
  return NextResponse.json(
    { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to create community reply.' },
    { status: 503 },
  );
}

export async function POST(request: Request, { params }: RouteParams) {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const parsed = await parseReplyBody(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const replyText = parsed.data;

  const { postId } = await params;

  try {
    const result = await replyToFeedCommunityPost(gate.auth.userId, postId, replyText);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.community.post.reply',
      status: 'allow',
      reason: 'community_reply_allowed',
      targetType: 'feed_community_post',
      targetId: postId,
      result: 'success',
      errorCategory: null,
      metadata: {
        replyId: result.replyId,
      },
    });

    return NextResponse.json({ ok: true, replyId: result.replyId, createdAt: result.createdAtIso }, { status: 201 });
  } catch (error) {
    return mapReplyError(error);
  }
}
