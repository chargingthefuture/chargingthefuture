import { NextResponse } from 'next/server';
import type { CommonsAnnouncementRepliesResponse } from 'lib/commons/types';
import { FEED_ERROR_CODE, FEED_MAX_COMMUNITY_REPLY_LENGTH } from 'lib/feed/constants';
import { listAnnouncementReplies, replyToAnnouncement, validateFeedCommunityReplyBody } from 'lib/feed/repository';
import { feedAuthorHandle } from 'lib/feed/author-handle';
import { logFeedAudit } from 'lib/feed/audit';
import { reportError } from 'lib/observability/report';
import { ensureMutationCsrf, requireFeedReadAccess } from '../../../feed/_lib';
import { failureReason } from 'lib/errors/failure';

// Replies on an official announcement. GET returns the thread (oldest-first) with each author
// resolved to a display handle; POST adds the signed-in member's reply. Replies live in our own
// database (announcement_replies), keyed on the announcement, and group under it as a thread.

type ReplyRequestBody = {
  body?: unknown;
};

type RouteParams = {
  params: Promise<{ announcementId: string }>;
};

// Map a reply-create failure to its response. Known error codes carry their own status; anything
// else is reported and returned as a generic 503.
function mapAnnouncementReplyError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : 'unknown_error';
  if (code === 'announcement_not_found') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.notFound, message: 'The announcement you are replying to is no longer available.' },
      { status: 400 },
    );
  }
  if (code === 'content_policy_violation') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.moderationRejected, message: 'Reply blocked by content moderation.' },
      { status: 422 },
    );
  }
  if (code === 'rate_limit_exceeded') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.rateLimitExceeded, message: 'You are replying too quickly. Try again shortly.' },
      { status: 429 },
    );
  }

  reportError(error, { area: 'announcements', op: 'create_reply' });
  return NextResponse.json(
    { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to post your reply.' },
    { status: 503 },
  );
}

export async function GET(_request: Request, { params }: RouteParams) {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { announcementId } = await params;

  try {
    const replies = await listAnnouncementReplies(announcementId);
    const response: CommonsAnnouncementRepliesResponse = {
      ok: true,
      announcementId,
      replies: replies.map((reply) => ({
        id: reply.id,
        author: feedAuthorHandle(reply.authorUsername, reply.authorUserId),
        isMine: reply.authorUserId === gate.auth.userId,
        body: reply.body,
        sentAtIso: reply.createdAtIso,
        editedAtIso: reply.editedAtIso,
      })),
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'announcements', op: 'list_replies' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to load replies.' },
      { status: 503 },
    );
  }
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

  const { announcementId } = await params;

  let body: ReplyRequestBody;
  try {
    body = (await request.json()) as ReplyRequestBody;
  } catch (error) {
    return NextResponse.json({ ok: false, message: 'Invalid JSON payload.', reason: failureReason(error) }, { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body : '';
  if (!validateFeedCommunityReplyBody(text)) {
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.invalidPayload,
        message: `Reply must be between 1 and ${FEED_MAX_COMMUNITY_REPLY_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  try {
    const authorUsername = gate.auth.username ?? null;
    const result = await replyToAnnouncement(gate.auth.userId, announcementId, text, authorUsername);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.reply.create',
      status: 'allow',
      reason: 'actor_authenticated',
      targetType: 'announcement',
      targetId: announcementId,
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json(
      {
        ok: true,
        reply: {
          id: result.replyId,
          author: feedAuthorHandle(authorUsername, gate.auth.userId),
          isMine: true,
          body: text.trim(),
          sentAtIso: result.createdAtIso,
          editedAtIso: null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return mapAnnouncementReplyError(error);
  }
}
