// What a member can tell us about their Quora account when they cannot give the profile URL itself.
//
// Its own module, with no database import, because both sides need it: the Unlock screen's help box
// (a client component) and the route that stores what the box sent. Putting it in help-requests.ts
// would drag the Postgres client into the browser bundle.

// The longest hint kept. Long enough for a profile link with a long slug on it, short enough that the
// field cannot be used to post an essay into an admin panel.
export const UNLOCK_QUORA_HINT_MAX_LENGTH = 300;

// Trim a hint to what is worth storing: whitespace off both ends, capped, and an empty string treated
// as nothing given. Deliberately no URL validation — a member who could produce a well-formed URL
// would have used the field above this one, so rejecting a hint for its shape rejects the only people
// it exists for.
export function normalizeUnlockQuoraHint(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, UNLOCK_QUORA_HINT_MAX_LENGTH);
}
