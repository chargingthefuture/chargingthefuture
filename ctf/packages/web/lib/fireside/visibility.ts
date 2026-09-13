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

import type { FiresideCommentStatus } from './types';

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
 * Three conditions, and the third is the one that matters: the author has to have asked for it.
 * The words belong to whoever wrote them, so permanence is their choice and the default is off — a
 * web capture cannot be withdrawn afterwards by anybody, including us.
 */
export function mayExportToBlog(input: CommentVisibilityInput & { exportOptIn: boolean }): boolean {
  return input.exportOptIn && isPubliclyVisible(input);
}
