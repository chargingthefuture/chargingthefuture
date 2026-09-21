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
- The ask rotates every day across the three Peace Battle 2 actions — say something under a post,
  take a slot on TI Radio, post your 1% — so three days running never ask for the same thing.
- Within an action, the pool is worked through in a shuffled order with no repeat until it is
  exhausted. The shuffle is seeded by the pass number, so each pass through a pool is a different
  order and the same date always gives the same message.
- Ten messages per action, three actions: thirty days before anything comes back.
- A date before day one clamps to day one rather than failing, so opening the screen early shows
  something usable.

## Adding or editing a message

The pools are `lib/quora-motd/messages-fireside.ts`, `messages-ti-radio.ts` and
`messages-one-percent.ts`. Keep them the same length as each other, or one action's messages come
around more often than another's.

- `id` is stable across edits to the text. Changing an id changes where it lands in the rotation.
- `title` and `body` are stored as two values, but they are copied as one. Quora's composer has no
  title field — a post is one box — so the screen's single copy control hands over the title, a
  blank line, then the body, which is the order the preview shows them in. The two values stay
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
