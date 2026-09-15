// What a published host list does and does not mean.
//
// TI Radio prints a week of discussions with the host's handle against each one, and Chyme's public
// room is readable without an account. Both are open on purpose: the people they were built for are
// arriving from a Quora space and have not joined anything. That openness has a cost, and this
// string is the cost being stated rather than hoped away.
//
// A schedule with names on it reads as a line-up somebody curated. Nobody curated it. A slot is
// taken, not granted: any approved member books an open time and writes their own description, and
// no one reviews the topic first. So a reader who assumes the project vouches for a host has been
// misled by the shape of the page, not by anything it says — which is exactly the kind of wrong
// impression worth correcting in the copy rather than in an apology later.
//
// Owner directive, 2026-09-15: the word is endorsement, not recommendation. A recommendation is a
// soft opinion somebody is free to weigh, and disclaiming one concedes that the project was offering
// an opinion at all. What a reader actually infers from a published schedule under this project's
// name is that the project stands behind the people on it, and that is the thing being denied. The
// constant has been named HOSTING_NOT_ENDORSEMENT since it was written; the copy now agrees with it.
//
// It is deliberately not a safety claim. Saying a room is moderated, screened or safe would be
// worth more than it is true, and a person deciding whether to turn up is better served by an
// accurate account of what the listing is: a booking, and rules that apply afterwards.
//
// One string, shared, because two surfaces making the same promise in different words is how one of
// them ends up implying an endorsement the other disclaims. Plain copy with no plugin imports, so
// any capability can read it without crossing a boundary (rule 112).
//
// It lives in @ctf/shared rather than in the web package because Chyme is on the Android keep-list
// (rule 105) and the native room carries the same statement. A copy pasted into the mobile package
// would be a second wording free to drift from this one — the exact failure this file exists to
// prevent — so the string crosses the package boundary instead of the text being retyped.

/** The endorsement disclaimer, for any surface that publishes who is hosting. */
export const HOSTING_NOT_ENDORSEMENT =
  'A slot is taken, not granted. Any approved member can book an open time and write their own '
  + 'description, nobody reviews it first, and a name here is not an endorsement — this project '
  + 'does not vouch for a host or for what gets said in their room. The rules still apply in the room, '
  + 'and an account goes for breaking them.';

/** The short form, for a card with no room for the full statement. */
export const HOSTING_NOT_ENDORSEMENT_SHORT =
  'Hosts book their own slots. A name here is not an endorsement, and the rules still apply in the room.';
