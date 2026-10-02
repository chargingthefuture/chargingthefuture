# Quora Message of the Day

One post a day for the Skills Economy space (`https://skillseconomy.quora.com`), written in advance
so that an account with a short life still says one complete thing before it goes.

Screen: `/admin/quora-message-of-the-day`. Admin only, no database, no API route — the pool is a
static file and the day's pick is arithmetic on the date.

## Why it exists in this shape

The blog's standing record of erased handles (`old-links-new-links` in `wiki-site`) documents
forty-seven accounts. The recorded lifetimes are not evenly spread across a day: one handle was
banned inside the same minute it was opened, another lasted thirty-three minutes. So a message
composed later in the day is often composed for an account that no longer exists.

Three things follow, and they are why each message is written the way it is:

1. **It stands on its own.** The account and the post die together, so a reader may never reach the
   link. The text carries its point first; the link is what survives for whoever does click.
2. **One message, not a choice of several.** A new account has no followers, so the post lands in
   the space or nowhere. One message a day is one thing for everybody who arrives, rather than a
   wall to skim.
3. **The format is chosen for the reader.** Handles have been banned before any post could have
   been read, which puts the decision at the account rather than at the writing, so there is
   nothing in the text to shape around a filter.

## How the rotation works

`lib/quora-motd/select.ts`.

- Day one is `2026-09-18`, the day Peace Battle 2 starts.
- The day is taken in `America/New_York`, not the server's UTC. Without that, every message after
  8pm Eastern would be the next day's.
- The ask rotates every day across the three Enact steps on the Peace Battle 2 page — see your 1%
  in Workforce, start on it on the PeerProgramming goal board, take it further with One Percent —
  so three days running never ask for the same thing. The steps follow the page: Fireside and TI
  Radio left both on 2026-10-02, when the outward message narrowed to the goal board, the Peace
  Battle 2 page and One Percent (see "Feature freeze, and one message" in `CLAUDE.md`).
- Within an action, the pool is worked through in a shuffled order with no repeat until it is
  exhausted. The shuffle is seeded by the pass number, so each pass through a pool is a different
  order and the same date always gives the same message.
- Ten messages per action, three actions: thirty days before anything comes back.
- A date before day one clamps to day one rather than failing, so opening the screen early shows
  something usable.

## The day line

Every post opens with which day of the protest it is and the Peace Battle 2 page under its short
address (`/pb2`), built by `motdDayLine` in `lib/quora-motd/types.ts`. The page is the lead link,
ahead of chargingthefuture.com, so it sits in the first line rather than at the foot.

The day is the count the page's own clock shows: days since Friday 18 September 2026 at 7:00 PM
Eastern, taken by calendar day in Eastern so it changes once a day. The opening night is not a day
of its own, so the first full day, 19 September, is Day 1, and 2 October is Day 14. The line is
generated, not stored with the message, so a message reads the right day whenever the rotation
reaches it.

The line states the protest as a stand rather than a grievance: Targeted Individuals holding it for
their lives, by building what cannot be taken. Quora has mostly carried the second kind of post;
these are meant to mobilize.

## Adding or editing a message

The pools are `lib/quora-motd/messages-one-percent.ts`, `messages-goal-board.ts` and
`messages-one-percent-call.ts`. Keep them the same length as each other, or one action's messages
come around more often than another's.

Every One Percent message says that the first two steps are complete without it and stay free. A
paid step that reads as the real one turns the free steps into a preview, and they are not one.

- `id` is stable across edits to the text. Changing an id changes where it lands in the rotation.
- `title` and `body` are stored as two values, but they are copied as one. Quora's composer has no
  title field — a post is one box — so the screen's single copy control hands over the day line,
  the title, then the body, each after a blank line, which is the order the preview shows them in. The two values stay
  apart because the list of what is coming shows titles on their own.
- `body` is plain text, one paragraph per line, no markdown of any kind — Quora's editor shows
  every marker literally. It ends with a `Full post:` line. That label is load-bearing: an address
  alone on its own line is what the editor turns into a preview card, and the blog's paste sheets
  have always kept the link as written instead.
- Every figure in a message should be published by somebody else, in the public domain, or fixed by
  the goal itself. A figure that moves — a member count, a follow count without its date — will be
  wrong by the time the rotation comes back to it.
- The blog's writing rules apply to this text, because it is published writing. Read
  `wiki-site/CLAUDE.md` before adding one: no perp language outside the archive, Targeted
  Individual capitalized, survivors as the default word, credits never described as money, no
  sentence that turns somebody's harm into a resource, and no sign-up drive in the body.

## Why the screen is admin-only

Every message is meant to appear in the space before it appears anywhere else. A public page
listing the pool in advance would put the text on the open web first, which is the thing the blog's
paste sheets exist to avoid: a rebuilt account has to be able to post a piece without it matching
something already published.
