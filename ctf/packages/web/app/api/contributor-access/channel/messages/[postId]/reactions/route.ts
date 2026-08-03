import { NextResponse } from 'next/server';
import { requireGatedChannelAccess } from '../../../_lib';
import { ensureMutationCsrf } from '../../../../admin/_lib';
import { toggleGatedChannelReaction } from 'lib/contributor-access/channel-repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Toggle the member's emoji reaction on a gated-channel post. The emoji must belong to the fixed
// gated reaction set (richer than the Commons set, validated server-side).

type ReactionBody = {
  emoji?: unknown;
};

export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  const gate = await requireGatedChannelAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: ReactionBody;
  try {
    body = (await request.json()) as ReactionBody;
  } catch (error) {
    return NextResponse.json({ ok: false, message: 'Invalid JSON payload.', reason: failureReason(error) }, { status: 400 });
  }

  const emoji = typeof body.emoji === 'string' ? body.emoji : '';
  const { postId } = await context.params;

  try {
    const result = await toggleGatedChannelReaction({ postId, userId: gate.auth.userId, emoji });
    return NextResponse.json({ ok: true, reacted: result.reacted }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error';
    if (code === 'invalid_emoji') {
      return NextResponse.json({ ok: false, message: 'That reaction is not available here.' }, { status: 400 });
    }
    if (code === 'post_not_found') {
      return NextResponse.json({ ok: false, message: 'That message is no longer available.' }, { status: 404 });
    }
    reportError(error, { area: 'contributor-access', op: 'channel_reaction_toggle' });
    return NextResponse.json({ ok: false, message: 'Unable to update your reaction.' }, { status: 503 });
  }
}
