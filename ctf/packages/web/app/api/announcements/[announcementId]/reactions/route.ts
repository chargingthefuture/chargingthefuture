import { NextResponse } from 'next/server';
import { FEED_ERROR_CODE, isAllowedFeedReactionEmoji } from 'lib/feed/constants';
import { toggleAnnouncementReaction } from 'lib/feed/repository';
import { logFeedAudit } from 'lib/feed/audit';
import { reportError } from 'lib/observability/report';
import { ensureMutationCsrf, requireFeedReadAccess } from '../../../feed/_lib';
import { failureReason } from 'lib/errors/failure';

// Toggle the signed-in member's emoji reaction on an official announcement. Reactions live in our
// own database (announcement_reactions), keyed on the announcement. A second tap of the same emoji
// removes it. The emoji must be in the fixed quick set; anything else is rejected (400).

type ReactionRequestBody = {
  emoji?: unknown;
};

type RouteParams = {
  params: Promise<{ announcementId: string }>;
};

// Map a toggle-reaction failure to its response. Known error codes carry their own status; anything
// else is reported and returned as a generic 503.
function mapAnnouncementReactionError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : 'unknown_error';
  if (code === 'reaction_emoji_invalid') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Unsupported reaction emoji.' },
      { status: 400 },
    );
  }
  if (code === 'announcement_not_found') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.notFound, message: 'The announcement you are reacting to is no longer available.' },
      { status: 400 },
    );
  }
  if (code === 'cannot_react_to_own_post') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.forbidden, message: 'You can’t react to your own announcement.' },
      { status: 403 },
    );
  }

  reportError(error, { area: 'announcements', op: 'toggle_reaction' });
  return NextResponse.json(
    { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to update your reaction.' },
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

  const { announcementId } = await params;

  let body: ReactionRequestBody;
  try {
    body = (await request.json()) as ReactionRequestBody;
  } catch (error) {
    return NextResponse.json({ ok: false, message: 'Invalid JSON payload.', reason: failureReason(error) }, { status: 400 });
  }

  const emoji = typeof body.emoji === 'string' ? body.emoji : '';
  if (!isAllowedFeedReactionEmoji(emoji)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Unsupported reaction emoji.' },
      { status: 400 },
    );
  }

  try {
    const result = await toggleAnnouncementReaction(gate.auth.userId, announcementId, emoji);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.reaction.toggle',
      status: 'allow',
      reason: 'actor_authenticated',
      targetType: 'announcement',
      targetId: announcementId,
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, reacted: result.reacted }, { status: 200 });
  } catch (error) {
    return mapAnnouncementReactionError(error);
  }
}
