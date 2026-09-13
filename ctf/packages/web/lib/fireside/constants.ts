// Fireside — threaded conversation on published blog posts.
//
// Separate from Commons on purpose (owner decision, 2026-09-13). Commons is support and learning
// the app. Fireside is conversation about trafficking and rebuilding, which needs room for nuance
// and a different moderation posture, even though one admin works both from the same panel.

export const FIRESIDE_PLUGIN_ID = 'fireside';

// One level of replies and no more. Deeper nesting is unreadable at phone width, which is the only
// width this app has.
export const FIRESIDE_MAX_REPLY_DEPTH = 1;

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
