// Curated community reviews shown in the public reviews widget and on the
// "What Survivors Are Saying" wall (/reviews). This is an owner-curated list —
// NOT member-submitted — so there is no moderation queue or abuse surface.
//
// Attribution policy (owner decision): show a first name + last initial and a
// link to the original public comment; never a full name unless `consent` is
// explicitly true. Only add real, attributable, owner-approved entries — never
// fabricate a review. To add one, append an object below and set `active: true`.
//
// One source of truth: the public GET /api/reviews route returns
// `getActiveReviews()`, and both the web app widget and the marketing landing
// page read from that endpoint.

export type ReviewSource = 'Quora' | 'X' | 'Reddit' | 'Email' | 'Other';

export type Review = {
  /** Stable id (used as the React key and for dismissal memory). */
  id: string;
  /** Display name — first name + last initial by default (e.g. "Jen S."). */
  author: string;
  /** Where the comment was originally posted. */
  source: ReviewSource;
  /** Link to the original public comment. */
  sourceUrl: string;
  /** The quoted comment, verbatim. */
  quote: string;
  /** Short, non-identifying context (e.g. what it was about). Optional. */
  context?: string;
  /** ISO date (YYYY-MM-DD) the comment was posted. Optional. */
  date?: string;
  /** True only when the person has agreed to be shown by full name. Default false. */
  consent: boolean;
  /** Set false to hide an entry without deleting it. */
  active: boolean;
};

// Newest first.
export const REVIEWS: Review[] = [
  {
    id: 'jen-s-quora-2026-07',
    author: 'Jen S.',
    source: 'Quora',
    sourceUrl:
      'https://skillseconomy.quora.com/https-www-quora-com-Have-most-AI-like-Claude-shown-to-be-openly-disbelieving-in-anything-similar-to-gang-or-organized',
    quote:
      'This will make a difference in so many lives that are being tormented. I believe it will be one of the tools that will help bring this parasitic entity to an end.',
    context: 'On the community chatbot announcement',
    date: '2026-07-27',
    consent: false,
    active: true,
  },
];

/** Active reviews, newest first — the exact projection the public API returns. */
export function getActiveReviews(): Review[] {
  return REVIEWS.filter((review) => review.active);
}
