// What Fireside owes people the moment Unlock approves one of its writers.
//
// Approval here is retroactive and per person: everything somebody has already written appears at
// once. The replies among those were held from public view when they were made, so nobody was told
// about them — telling a person about a reply they would open and not find is worse than telling
// them nothing, which is why the notification at write time checks that the reply is publicly
// visible first.
//
// The cost of that, until now, was that the notice never arrived at all. A member answered somebody
// on their first day, waited to be approved, and the person they answered was never told: their
// conversation quietly grew a reply while they were not looking, and the only way to find it was to
// go back to the post. This is that debt being paid at the one moment it can be.
//
// Called through lib/shared/unlock-approval-interface.ts, never by Unlock directly — plugins stay
// isolated from each other (rule 112) and this file must not learn anything about Unlock beyond the
// user id it is handed.

import { notifySafe } from 'lib/notifications/repository';
import { listRepliesAwaitingNotice } from './repository';

/**
 * Tell the people this member answered, now that their replies are public.
 *
 * One notice per person, never one per reply. Somebody answered five times hears once, which is
 * what makes running this uncapped safe: the pile-up a cap would guard against only ever happened
 * when many replies landed on the same person, and the collapsing removes it at the source. So
 * everybody who was answered is told, however much the member wrote — where the first version
 * stopped at fifty replies and the rest were simply never mentioned to anyone.
 *
 * Returns how many people were told, for the audit row the caller writes. Emitting is idempotent:
 * `notifySafe` dedupes on the event, and the reference is the earliest reply to each person, which
 * is a fixed choice — so a second approval of the same account, or a re-run, pings nobody twice.
 *
 * Best-effort and it says so: a notification that fails must never fail the approval it followed.
 * Approval is the thing that matters here and it is already committed by the time this runs.
 */
export async function announceHeldReplies(userId: string): Promise<number> {
  // One entry per person answered, not per reply — the repository collapses it.
  const answered = await listRepliesAwaitingNotice(userId);

  for (const reply of answered) {
    const query = new URLSearchParams({ repo: reply.postRepo, slug: reply.postSlug });
    if (reply.postTitle) query.set('title', reply.postTitle);

    await notifySafe({
      userId: reply.parentAuthorUserId,
      sourcePlugin: 'fireside',
      // The same type the reply itself would have emitted, so one conversation does not produce two
      // kinds of notice for the same event, and the dedupe below actually matches.
      notificationType: 'fireside.reply',
      category: 'community',
      // Names no content and no person: this can land on a lock screen, and a reply about
      // trafficking is not something to put there. Deliberately silent about how many replies it
      // stands for — the recipient reads the conversation to find that out, and a count here would
      // be a fact about somebody's activity on a notification that is meant to carry none.
      summary: 'Somebody replied to your comment on the blog.',
      linkPath: `/apps/fireside?${query.toString()}`,
      // The earliest reply to this person, which is a fixed choice rather than whichever row came
      // back first. That is what makes a re-run, or an account approved twice, silent rather than a
      // second ping — and it is the same shape of reference the write-time notice uses.
      targetRef: reply.commentId,
    });
  }

  return answered.length;
}
