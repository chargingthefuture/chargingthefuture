import { NextResponse } from 'next/server';
import { FEED_ERROR_CODE, FEED_MAX_COMMUNITY_REPLY_LENGTH } from 'lib/feed/constants';
import {
  deleteAnnouncementReply,
  editAnnouncementReply,
  normalizeUuid,
  validateFeedCommunityReplyBody,
} from 'lib/feed/repository';
import { logFeedAudit } from 'lib/feed/audit';
import { reportError } from 'lib/observability/report';
import { ensureMutationCsrf, requireFeedReadAccess } from '../../../../feed/_lib';
import { failureReason } from 'lib/errors/failure';

// A member's own reply on an official announcement: PATCH rewrites it, DELETE removes it. Both are
// author-only — the repository checks ownership, so nobody can change or remove someone else's
// words through this route. A moderator taking a reply down uses the reversible hide on the admin
// moderation route instead, which is a different power and leaves the words recoverable.

type RouteParams = {
  params: Promise<{ announcementId: string; replyId: string }>;
};

// Map a reply edit/delete failure to its response. Ownership and existence failures carry their own
// status; anything else is reported and returned as a generic 503.
function mapReplyMutationError(error: unknown, actorId: string, replyId: string, command: string): NextResponse {
  const code = error instanceof Error ? error.message : 'unknown_error';

  if (code === 'reply_not_found') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.notFound, message: 'That reply is no longer available.' },
      { status: 404 },
    );
  }
  if (code === 'not_reply_owner') {
    // Only the author can change their own reply. Log the denied attempt for accountability.
    logFeedAudit({
      actorId,
      pluginId: 'feed',
      command,
      status: 'deny',
      reason: 'actor_not_reply_owner',
      targetType: 'announcement_reply',
      targetId: replyId,
      result: 'failure',
      errorCategory: 'authorization',
    });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.forbidden, message: 'You can only change your own replies.' },
      { status: 403 },
    );
  }
  if (code === 'reply_hidden') {
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.forbidden,
        message: 'A moderator has hidden this reply, so it cannot be edited.',
      },
      { status: 403 },
    );
  }
  if (code === 'content_policy_violation') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.moderationRejected, message: 'Reply blocked by content moderation.' },
      { status: 422 },
    );
  }

  reportError(error, { area: 'announcements', op: command });
  return NextResponse.json(
    { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to change your reply.' },
    { status: 503 },
  );
}

// Reject a malformed id before it reaches the repository, so an arbitrarily long or malformed path
// segment cannot waste a database round-trip.
function readReplyId(rawReplyId: string): { replyId: string } | { error: NextResponse } {
  const replyId = normalizeUuid(rawReplyId);
  if (!replyId) {
    return {
      error: NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid reply id.' },
        { status: 400 },
      ),
    };
  }
  return { replyId };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { replyId: rawReplyId } = await params;
  const parsedId = readReplyId(rawReplyId);
  if ('error' in parsedId) {
    return parsedId.error;
  }

  let body: { body?: unknown };
  try {
    body = (await request.json()) as { body?: unknown };
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
    const result = await editAnnouncementReply(gate.auth.userId, parsedId.replyId, text);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.reply.update',
      status: 'allow',
      reason: 'author_edit',
      targetType: 'announcement_reply',
      targetId: parsedId.replyId,
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json(
      { ok: true, replyId: parsedId.replyId, body: result.body, editedAtIso: result.editedAtIso },
      { status: 200 },
    );
  } catch (error) {
    return mapReplyMutationError(error, gate.auth.userId, parsedId.replyId, 'feed.announcement.reply.update');
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { replyId: rawReplyId } = await params;
  const parsedId = readReplyId(rawReplyId);
  if ('error' in parsedId) {
    return parsedId.error;
  }

  try {
    await deleteAnnouncementReply(gate.auth.userId, parsedId.replyId);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.reply.delete',
      status: 'allow',
      reason: 'author_delete',
      targetType: 'announcement_reply',
      targetId: parsedId.replyId,
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, replyId: parsedId.replyId }, { status: 200 });
  } catch (error) {
    return mapReplyMutationError(error, gate.auth.userId, parsedId.replyId, 'feed.announcement.reply.delete');
  }
}
