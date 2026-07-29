import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../../_lib';
import { FEED_ERROR_CODE, FEED_MODERATION_STATUS } from 'lib/feed/constants';
import { setCommunityModerationStatus, type FeedModerationTarget } from 'lib/feed/moderation';
import { logFeedAudit } from 'lib/feed/audit';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// POST: hide or un-hide one Commons post or reply.
//
// Hiding rather than deleting is the whole point. Deletion is unrecoverable and takes the member's
// own words plus the reply thread with it; hiding is reversible, so a moderator making a fast
// judgement call is not making a permanent one. The member's own delete control is unchanged — this
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
  if (target !== 'post' && target !== 'reply') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Target must be post or reply.' },
      { status: 400 },
    );
  }

  let body: { hidden?: unknown };
  try {
    body = (await request.json()) as { hidden?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  // Required rather than defaulted: an absent field would otherwise silently mean "un-hide", and a
  // malformed request must never quietly put hidden content back in front of members.
  if (typeof body.hidden !== 'boolean') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Send hidden: true or hidden: false.' },
      { status: 400 },
    );
  }

  const next = body.hidden ? FEED_MODERATION_STATUS.hidden : FEED_MODERATION_STATUS.accepted;

  try {
    const outcome = await setCommunityModerationStatus({
      target: target as FeedModerationTarget,
      id,
      next,
    });

    if (outcome.status === 'not_found') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.notFound, message: 'That post or reply no longer exists.' },
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
      command: body.hidden ? 'feed.community.moderation.hide' : 'feed.community.moderation.restore',
      status: 'allow',
      reason: 'admin_moderation_allowed',
      targetType: target === 'post' ? 'feed_community_post' : 'feed_community_reply',
      targetId: id,
      result: 'success',
      errorCategory: null,
      // The statuses, not the content: an audit trail of what a member wrote would duplicate the
      // content it is meant to be a record ABOUT, in a log with a different retention story.
      metadata: { previousStatus: outcome.previous, newStatus: outcome.next },
    });

    return NextResponse.json({ ok: true, changed: true, moderationStatus: outcome.next }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_moderation_set' });
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.persistenceUnavailable,
        message: 'Could not change that post. Nothing was altered — try again.',
      },
      { status: 503 },
    );
  }
}
