import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../../_lib';
import {
  FEED_ERROR_CODE,
  FEED_MODERATION_REASON,
  FEED_MODERATION_STATUS,
  isFeedModerationReason,
  type FeedModerationReason,
  type FeedModerationStatus,
} from 'lib/feed/constants';
import { isFeedModerationTarget, setCommunityModerationStatus } from 'lib/feed/moderation';
import { logFeedAudit } from 'lib/feed/audit';
import { reportError } from 'lib/observability/report';
import { failureReason, withReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// Parse and validate the moderation request body. Returns the resolved transition (next status and
// reason) or a ready-to-return error response, so the handler keeps its narrowing via destructuring.
async function parseModerationBody(
  request: Request,
): Promise<
  | { error: NextResponse }
  | { data: { hidden: boolean; next: FeedModerationStatus; reason: FeedModerationReason | null } }
> {
  let body: { hidden?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as { hidden?: unknown; reason?: unknown };
  } catch (caught) {
    return {
      error: NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: withReason('Invalid JSON body', caught) },
        { status: 400 },
      ),
    };
  }

  // Required rather than defaulted: an absent field would otherwise silently mean "un-hide", and a
  // malformed request must never quietly put hidden content back in front of members.
  if (typeof body.hidden !== 'boolean') {
    return {
      error: NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Send hidden: true or hidden: false.' },
        { status: 400 },
      ),
    };
  }

  const next = body.hidden ? FEED_MODERATION_STATUS.hidden : FEED_MODERATION_STATUS.accepted;

  // A reason is only meaningful when hiding, and it is validated against the fixed code set rather
  // than accepted as free text: a moderator's prose about a member would become a permanent,
  // unreviewable note attached to a survivor's account. An unrecognized or absent code falls back to
  // 'other' instead of 400 — a hide is time-sensitive and should never fail over its label.
  const reason = body.hidden
    ? (isFeedModerationReason(body.reason) ? body.reason : FEED_MODERATION_REASON.other)
    : null;

  return { data: { hidden: body.hidden, next, reason } };
}

// POST: hide or un-hide one piece of member-facing content — a Commons post, a reply on a post or on
// an official announcement, or a question or answer in the Q&A.
//
// Hiding rather than deleting is the whole point. Deletion is unrecoverable and takes the member's
// own words plus the reply thread with it; hiding is reversible, so a moderator making a fast
// judgment call is not making a permanent one. The member's own delete control is unchanged — this
// route is the moderator's power, and it stops at visibility: there is no admin edit, because
// rewriting someone's words while leaving their name on them is not moderation.
//
// Every transition is audited with the before and after status. A request that would not change
// anything is reported as `unchanged` and writes no audit entry, so the trail never claims a
// transition that did not occur (a double-tap, or a retried request, is not a second decision).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ target: string; id: string }> },
) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { target, id } = await params;
  if (!isFeedModerationTarget(target)) {
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.invalidPayload,
        message: 'Target must be post, reply, announcement-reply, question, or answer.',
      },
      { status: 400 },
    );
  }

  const parsed = await parseModerationBody(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { hidden, next, reason } = parsed.data;

  try {
    const outcome = await setCommunityModerationStatus({
      target,
      id,
      next,
      reason,
      actorUserId: gate.auth.userId,
    });

    if (outcome.status === 'not_found') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.notFound, message: 'That content no longer exists.' },
        { status: 404 },
      );
    }

    if (outcome.status === 'unchanged') {
      return NextResponse.json(
        { ok: true, changed: false, moderationStatus: outcome.previous },
        { status: 200 },
      );
    }

    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: hidden ? 'feed.community.moderation.hide' : 'feed.community.moderation.restore',
      status: 'allow',
      reason: 'admin_moderation_allowed',
      targetType: `feed_${target}`,
      targetId: id,
      result: 'success',
      errorCategory: null,
      // The statuses, not the content: an audit trail of what a member wrote would duplicate the
      // content it is meant to be a record ABOUT, in a log with a different retention story.
      metadata: { previousStatus: outcome.previous, newStatus: outcome.next, reason },
    });

    return NextResponse.json({ ok: true, changed: true, moderationStatus: outcome.next }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_moderation_set' });
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.persistenceUnavailable,
        message: `Could not change that. Nothing was altered — try again: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
