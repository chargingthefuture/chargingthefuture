import { NextResponse } from 'next/server';
import { requireGatedChannelAccess } from '../../_lib';
import { ensureMutationCsrf } from '../../../admin/_lib';
import { deleteGatedChannelPost } from 'lib/contributor-access/channel-repository';
import { insertContributorAccessAudit } from 'lib/contributor-access/repository';
import { reportError } from 'lib/observability/report';

// Delete a gated-channel post. Same route shape as the Commons (DELETE /api/commons/messages/[postId])
// but a SOFT delete: deleted_at/deleted_by are set and every read excludes the row — content is
// hidden, not erased. Two allowed paths, audited under distinct commands:
//   - the post's author (contributor-access.channel.post.delete, reason author_delete);
//   - an admin removing any post (contributor-access.channel.post.moderator-delete — the
//     moderator power the in-channel disclosure line already discloses).
// Anyone else gets 403 and the denied attempt is audited. There is no Stream-side message to
// remove: the database is the message source of truth and Stream carries only presence/typing
// for this channel (no message content ever enters Stream), so deletion is complete once the row
// is soft-deleted — the other members' next poll/live refresh drops it.

export async function DELETE(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const gate = await requireGatedChannelAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { postId } = await context.params;

  try {
    const path = await deleteGatedChannelPost({
      postId,
      actorId: gate.auth.userId,
      isAdmin: gate.auth.isAdmin,
    });

    await insertContributorAccessAudit({
      actorId: gate.auth.userId,
      command: path === 'author'
        ? 'contributor-access.channel.post.delete'
        : 'contributor-access.channel.post.moderator-delete',
      policyStatus: 'allow',
      reason: path === 'author' ? 'author_delete' : 'admin_moderation_delete',
      targetType: 'contributor_access_channel_post',
      targetId: postId,
    });

    return NextResponse.json({ ok: true, postId }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error';
    if (code === 'post_not_found') {
      return NextResponse.json({ ok: false, message: 'That message is no longer available.' }, { status: 404 });
    }
    if (code === 'not_post_owner') {
      // Only the author (or an admin) can delete a post. Log the denied attempt.
      await insertContributorAccessAudit({
        actorId: gate.auth.userId,
        command: 'contributor-access.channel.post.delete',
        policyStatus: 'deny',
        reason: 'actor_not_post_owner',
        targetType: 'contributor_access_channel_post',
        targetId: postId,
      });
      return NextResponse.json(
        { ok: false, message: 'You can only delete your own messages.' },
        { status: 403 },
      );
    }
    reportError(error, { area: 'contributor-access', op: 'channel_message_delete' });
    return NextResponse.json({ ok: false, message: 'Unable to delete the message.' }, { status: 503 });
  }
}
