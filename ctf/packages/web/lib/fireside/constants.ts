// Fireside — threaded conversation on published blog posts.
//
// Separate from Commons on purpose (owner decision, 2026-09-13). Commons is support and learning
// the app. Fireside is conversation about trafficking and rebuilding, which needs room for nuance
// and a different moderation posture, even though one admin works both from the same panel.

export const FIRESIDE_PLUGIN_ID = 'fireside';

// One level of replies and no more. Deeper nesting is unreadable at phone width, which is the only
// width this app has.
export const FIRESIDE_MAX_REPLY_DEPTH = 1;

// The blog itself. Conversation happens under the posts, so a member who opens Fireside and has
// never written anything needs the way there to be on the screen — without it the only route to the
// thing this plugin is about is a search engine (owner report, 2026-09-14).
export const FIRESIDE_BLOG_BASE = 'https://chargingthefuture.github.io/chargingthefuture';

// Where a conversation's post lives. Somebody who arrived here from a post was reading it a moment
// ago, and with 300-odd posts on the blog, "back" has to mean the one they came from — anything
// else loses them, which is the same bounce the deep link exists to prevent.
export const FIRESIDE_BLOG_ARTICLE_BASE = `${FIRESIDE_BLOG_BASE}/article`;

/** The post a thread belongs to, as a reader's address for it. */
export function firesidePostUrl(repo: string, slug: string): string {
  return `${FIRESIDE_BLOG_ARTICLE_BASE}/${encodeURIComponent(repo)}/${slug
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

export const FIRESIDE_MAX_COMMENT_LENGTH = 4000;
export const FIRESIDE_MIN_COMMENT_LENGTH = 2;

// A day's worth of comments from one person. Not a quality judgment — a ceiling on how much damage
// one account can do in an afternoon before anybody looks at it.
export const FIRESIDE_MAX_COMMENTS_PER_DAY = 25;

// Fixed reaction kinds rather than free emoji, so a count means the same thing on every comment.
export const FIRESIDE_REACTION_KINDS = ['recognize', 'helpful', 'same_here'] as const;

export const FIRESIDE_REACTION_LABELS: Record<(typeof FIRESIDE_REACTION_KINDS)[number], string> = {
  recognize: 'I recognize this',
  helpful: 'This helped',
  same_here: 'Same here',
};

/**
 * Voting, which is a different thing from the reactions above and is stored the same way.
 *
 * Neither vote changes where a comment sits. Comments are ordered oldest first and that is the only
 * order there is — a vote does not move anything up or down the thread, and nothing anywhere reads
 * a count to decide position (owner decision, 2026-09-14). This is the inversion of the platform
 * this exists as an alternative to, where what gets read is decided by what was voted on.
 *
 * A person holds one of these per comment at a time: pressing one clears the other, because holding
 * both says nothing.
 */
export const FIRESIDE_VOTE_KINDS = ['upvote', 'downvote'] as const;

export const FIRESIDE_VOTE_LABELS: Record<(typeof FIRESIDE_VOTE_KINDS)[number], string> = {
  upvote: 'Agree',
  downvote: 'Disagree',
};

/** Everything that may be stored in `fireside_reactions.kind`, and everything a route will accept. */
export const FIRESIDE_ALL_REACTION_KINDS = [
  ...FIRESIDE_REACTION_KINDS,
  ...FIRESIDE_VOTE_KINDS,
] as const;

/**
 * The kinds that may ever appear in a count returned to anybody.
 *
 * `downvote` is deliberately missing and must stay missing. It is recorded, and the person who left
 * it sees their own, but no count of it is shown to anybody — not the author, not a reader, not an
 * admin screen (owner decision, 2026-09-14; what it should eventually do, whether it cancels an
 * upvote or is only read as feedback, is not decided yet, and showing a number now would settle
 * that by accident). Keeping it out of this list is what makes that structural rather than
 * something each screen has to remember.
 */
export const FIRESIDE_COUNTED_KINDS = [...FIRESIDE_REACTION_KINDS, 'upvote'] as const;

export const FIRESIDE_ERROR_CODE = {
  invalidPayload: 'fireside_invalid_payload',
  notFound: 'fireside_not_found',
  forbidden: 'fireside_forbidden',
  threadClosed: 'fireside_thread_closed',
  exportRefused: 'fireside_export_refused',
  rateLimited: 'fireside_rate_limited',
  csrfDenied: 'fireside_csrf_denied',
  persistenceUnavailable: 'fireside_persistence_unavailable',
} as const;

// Shown to somebody whose comment is saved but not yet public. Said at the moment of posting rather
// than left to be discovered: a comment that silently does not appear reads as censorship or as a
// broken page, and both cost the person who wrote it.
export const FIRESIDE_HELD_NOTICE =
  'Saved. It stays private until your account is approved — that means a person reads what you wrote, which is the same look the app already does before anyone is verified. Once you are approved, everything you have written here appears at once.';

// Shown beside a comment whose author has asked for it to go into the blog's published build. Said
// at the moment of asking, so nobody believes their words are already on their way out of the app.
export const FIRESIDE_EXPORT_PENDING_NOTICE =
  'Asked. An admin reads it before anything is copied to the blog, because that page is permanently archived and cannot be pulled back. Until then it stays here in the conversation, and you can switch this off at any time.';
