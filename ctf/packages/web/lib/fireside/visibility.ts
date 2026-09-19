// Who can see a Fireside comment, as one rule in one place.
//
// Two conditions, and they are deliberately separate:
//
//   1. The author is approved in Unlock. This is the verification half, and it is decided per
//      PERSON, not per comment. Approving somebody makes everything they have already written
//      appear at once — one decision, not one per item, which is what keeps the review queue
//      readable and makes the backlog the reward for finishing.
//   2. The comment has not been taken down. This is the moderation half, decided per comment.
//
// Keeping them apart is what stops approving a person from quietly un-removing something an admin
// took down, and stops a removal from looking like a verification problem to the author.
//
// Pure on purpose: the rule is the thing most likely to be re-derived wrongly somewhere else, and
// four faults in two weeks came from exactly that — a rule written in two places that disagreed.
// Every caller reads it from here, including the public route and the author's own screen.
//
// Copying a comment out to the blog's published build is a third, stricter question, answered by
// mayExportToBlog at the bottom of this file. It needs both the author and an admin to say yes.

import type { ExportReview, FiresideCommentStatus } from './types';

export type CommentVisibilityInput = {
  status: FiresideCommentStatus;
  authorIsApproved: boolean;
};

/** Visible to anybody, signed in or not. */
export function isPubliclyVisible(input: CommentVisibilityInput): boolean {
  return input.status === 'visible' && input.authorIsApproved;
}

/**
 * Visible to the person who wrote it. Somebody always sees their own words — held, removed or
 * live — because a comment that vanishes with no explanation is the failure this plugin exists to
 * avoid. What changes is the label beside it, not whether it is shown.
 */
export function isVisibleToAuthor(input: { authorUserId: string; viewerUserId: string | null }): boolean {
  return input.viewerUserId != null && input.viewerUserId === input.authorUserId;
}

/** Why an author may not rewrite a comment of theirs. Null means they may. */
export type EditRefusal = 'removed_by_admin' | 'withdrawn' | 'thread_closed';

/**
 * Whether the author may rewrite their own comment, and why not when they may not.
 *
 * The same policy the Commons has had since it shipped, which is where it was asked for: the
 * author, any time, with no window to beat, and the new words checked the way the first ones were
 * so an edit is never a way to post something a fresh comment would have been refused for. The row
 * keeps its id, so the replies under it and the reactions on it survive — taking a comment down and
 * writing it again loses all of that, and it was the only way to fix a typo until now.
 *
 * Three refusals, and each one is somebody else's decision the author does not get to reverse:
 *
 *   removed_by_admin — an admin took it down. Editing it would be a way back into the conversation
 *     that goes around them, and putting it back is theirs to do.
 *   withdrawn — the author took it down themselves. The words left the conversation and that cannot
 *     be undone; writing something new is a new comment.
 *   thread_closed — an admin closed the conversation. Closing is about what happens next, so
 *     nothing already written is touched or hidden — but it does mean the talking is done, and a
 *     rewrite is how somebody would carry on talking in a room that was closed. The stricter
 *     reading wins here; taking the comment down is still available.
 *
 * Whether the author is approved in Unlock is deliberately not one of them. A held comment is the
 * one somebody is most likely to want to fix, it is visible to nobody but them while they wait, and
 * approval is about the person rather than about any comment of theirs.
 */
export function refuseEdit(input: {
  status: FiresideCommentStatus;
  threadIsClosed: boolean;
}): EditRefusal | null {
  if (input.status === 'removed') return 'removed_by_admin';
  if (input.status === 'withdrawn') return 'withdrawn';
  if (input.threadIsClosed) return 'thread_closed';
  return null;
}

export type CommentState = 'live' | 'held_for_approval' | 'removed' | 'withdrawn';

/** What to tell the author about their own comment. One word for the screen to render from. */
export function commentStateForAuthor(input: CommentVisibilityInput): CommentState {
  if (input.status === 'removed') return 'removed';
  if (input.status === 'withdrawn') return 'withdrawn';
  return input.authorIsApproved ? 'live' : 'held_for_approval';
}

/**
 * Whether a comment may be copied into the blog's own published build, where it becomes searchable
 * and is captured by the Internet Archive.
 *
 * Four conditions, and two of them are separate keys held by different people. The author has to
 * ask (`exportOptIn`), because the words are theirs and permanence is their call — a web capture
 * cannot be withdrawn later by anybody, this project included. An admin then has to agree
 * (`exportReview`), because the build is a public page sitting beside the project's own writing:
 * an account opened to post spam or bait could otherwise put that text there permanently, and
 * nobody could take it back.
 *
 * Neither key does anything alone. An approved export whose author later withdraws consent stops
 * being exportable; an opted-in comment nobody has reviewed stays in the conversation and out of
 * the build.
 */
export function mayExportToBlog(
  input: CommentVisibilityInput & { exportOptIn: boolean; exportReview: ExportReview },
): boolean {
  return input.exportOptIn && input.exportReview === 'approved' && isPubliclyVisible(input);
}

/**
 * Whether the author of a comment should be told that somebody answered it.
 *
 * Here with the other visibility rules rather than in the route, because it is a visibility
 * question wearing a different hat: it asks who may know a reply exists. Three conditions, and each
 * one is a way this goes wrong in practice.
 *
 * It has to be a reply — a new top-level comment answers nobody. The reply has to be publicly
 * visible, because nothing an unapproved member writes is, and telling somebody about a reply they
 * will open and not find is worse than telling them nothing. And nobody is told about their own
 * reply to themselves, which is most replies in a conversation that has just started.
 */
export function shouldNotifyParentAuthor(input: {
  parentCommentId: string | null;
  isPubliclyVisible: boolean;
  parentAuthorUserId: string | null;
  replierUserId: string;
}): boolean {
  if (!input.parentCommentId) return false;
  if (!input.isPubliclyVisible) return false;
  if (!input.parentAuthorUserId) return false;
  return input.parentAuthorUserId !== input.replierUserId;
}
