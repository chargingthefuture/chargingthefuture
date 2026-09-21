# Fireside — Feature Inventory

## Scope and Boundary

Fireside is threaded conversation under the posts on the public blog (`wiki-site`). One thread per
post, comments under it, one level of replies, and three reaction kinds.

It is deliberately **not** the Commons. Commons is support and learning the app; Fireside is
conversation about trafficking and rebuilding. They share an admin who moderates both, and they
share the Commons guidelines, but they are separate rooms with separate data and separate postures.

Out of scope in this version, recorded so the next reader does not think it was forgotten:

- The comment widget on the blog itself. That lives in the `wiki-site` repository and ships as its
  own change; this side is the plugin, the data and the routes it calls.
- An in-app view for browsing every conversation. Owner decision, 2026-09-13: it is the same data in
  a different shape, and it waits until there is conversation to browse.
- Copying comments into the blog's published build. The per-comment permission exists and members
  can set it; the job that reads it and writes into the build does not exist yet.

## Intent and Outcome

Somebody reads a post on the blog and wants to say something about it. They can read every comment
without an account. To write one they sign in, and what they write becomes public once they are
approved in the app — which they are told at the moment they post, not left to discover.

The outcome is a conversation that stays: findable, linkable, and still there in a year, on a site
the project controls rather than on a platform that has erased five of its accounts.

## Implemented User Features

1. **Read without an account.** Every comment under a post is public, and it renders under the post
   on the blog itself — no sign-in, no gate, nothing to create. Reading is not something anybody has
   to qualify for.
2. **Write with an account.** Signing in is enough to leave a comment or a reaction. Nothing written
   is publicly visible until that person is approved in the app.
3. **The button under the post carries you to the same conversation.** Writing happens in the app,
   because the write routes are same-origin and a signed-in session lives on the app's domain. The
   link names the post, the app opens that exact conversation on arrival, and somebody who has to
   sign in first is returned to it rather than to a home page of twenty-five tiles. A first-time
   reader who lands somewhere they did not ask for leaves.
4. **Told at the moment of posting.** A held comment says so on screen, in plain words, including
   that a person will read it. A comment that saves and silently does not appear reads as
   censorship or as a broken page.
5. **Approval is per person, and retroactive.** When somebody is approved, every comment and every
   reaction they have left appears at once. One decision, not one per item.
6. **You always see your own words.** Held, removed or live, a member sees what they wrote, with a
   label saying which — on their own comments list and in the conversation itself, which is the
   screen they are on when they write. The label is on their own comments only; nothing is said
   anywhere about the state of anybody else's.
7. **Replies, one level deep.** A reply to a comment, and no reply to a reply. Deeper nesting is
   unreadable at phone width, which is the only width this app has. When somebody answers you, you
   are told, and the notification opens that conversation. Nothing arrives for a reply you cannot
   see yet, and nothing arrives for replying to yourself.
8. **Three reactions** — I recognize this, This helped, Same here. A fixed set rather than free
   emoji, so a count means the same thing on every comment.
8a. **Agree and disagree.** A vote changes a number beside a comment and nothing else. It never
   moves the comment: the thread is oldest first and nothing reads a count to decide what gets
   read, which is the inversion of the platform this exists as an alternative to. The agree count
   is shown. The disagree count is shown to nobody — not the author, not a reader, not an admin —
   because what a disagree should eventually do is not decided yet, and a number on a screen would
   decide it. The person who left one sees their own. Pressing one clears the other.
9. **Take your own comment down,** at any time, with no admin involved. The words go; the row stays
   so a reply underneath keeps its parent.
9. **Take your own comment down,** at any time, with no admin involved. The words go from the
   conversation; the row stays so a reply underneath keeps its parent. It asks before doing it,
   because it cannot be undone and no admin can put the words back. You keep your own copy of what
   you wrote, shown struck through on your screen and nowhere else — the moment somebody most needs
   to read what they wrote is just after they have destroyed it, when they are checking that they
   meant that one.
9a. **Fix your own words in place.** An author can rewrite their own comment at any time, with no
   window to beat and no admin involved, and the comment is marked as edited afterwards so changed
   words never read as the originals. The comment keeps its id, so the replies under it and the
   reactions on it stay where they are — before this the only way to correct a typo was to take the
   comment down and write it again, which loses all of that (owner report, 2026-09-17). The same
   policy the Commons has for a reply on an announcement. Three things it will not do: bring back a
   comment an admin removed, bring back one the author took down, or change anything in a
   conversation an admin has closed. If an admin had already approved the comment for the blog, the
   new wording goes back to the queue to be read again, and the author is told so on screen.
10. **Ask for a comment to be published with the post.** Off unless the author turns it on. Turning
   it on asks; it does not publish. An admin reads the request before anything is copied into the
   blog's own build, where it is searchable and captured by the Internet Archive and where nobody,
   this project included, can withdraw it later. The screen says which state the request is in —
   waiting, approved, or declined — and the author can take the ask back at any point before the
   copy is made, approved or not.
11. **Your own comments in one list,** on the Fireside screen in the app, paged, each labeled live,
    held, removed or withdrawn.
11a. **Search the conversation.** A search box on the same screen finds comments by what was
    written, across every post, and opens the conversation each one is in. It searches only what
    you can already read — a comment held until its author is approved is not in the results — and
    it shows nothing until you ask something, so the screen still opens on your own comments.
12. **A way to the blog, and a way back out.** The screen carries the standard app header with the
    shared back control, and a link to the blog both at the top and in the empty state — the
    conversation happens under the posts, so a member who has written nothing yet needs the route
    there on the screen rather than in a search engine.

## Implemented Admin Features

1. **Remove or restore a comment,** with a reason recorded. Moderation is kept separate from
   approval, so approving a person never resurrects something an admin took down, and a removal
   never reads to the author as a verification problem.
2. Removing a comment also clears its blog-export permission, so nothing on its way out of the app
   can carry a removed comment with it.
3. **Approve or decline a comment for the blog.** The author asking is one key; this is the other,
   and neither does anything alone. The queue is on the Fireside screen, oldest request first, and
   declining is final for that comment — the author cannot put it back in the queue by switching
   their own request on again.
4. **See the author's record beside each request** — how many comments they have written here, how
   many were removed, how many exports were declined or approved. An account with removals or
   refusals behind it is flagged on the row, with the note that the decision worth making is about
   the account rather than the comment. Moderating item by item is a losing race against somebody
   doing it deliberately; deleting the account settles it once.
5. **Close a thread** to new comments without removing what is already there, and open it again.
   Two routes to the same control: on the conversation itself, and from the Conversations list on
   the admin page. A member reads a line saying it is closed rather than being left to guess, and
   the comment box is not offered when writing would be refused.
6. **A list of every comment, newest first,** searchable by what people wrote, paged, with the page
   in the address bar so it can be linked and the back button works. Removed and withdrawn rows are
   listed alongside live ones: a
   list that hides what was already acted on cannot be used to undo anything, and undoing is most
   of what a moderation list is for. A comment its own author took down carries no control, because
   nobody can put that one back.
7. **A list of every conversation,** the one with the newest comment first, paged. Each row says how
   many comments are in it and how many were removed or taken down, so a thread that reads as empty
   says why rather than looking like one nobody wrote in. Closed conversations are listed alongside
   open ones and labeled.
8. **An audit log an admin can read.** Every write has recorded a row since the plugin shipped and
   nothing in the app ever showed one; a record nobody can read is not a check on anything.
9. Every write is recorded in `fireside_audit_events`, including both halves of an export decision —
   the author's request and the admin's answer — because that pair is what lets text leave the app
   for somewhere it cannot be recalled from.
10. All of the above live on one screen, `/admin/fireside`, reached from the admin directory like
   every other plugin's admin page. The four tabs are the export queue, every comment, the
   conversations, and the audit log.

## API Surface and Route Map

| Route | Method | Who | What |
|---|---|---|---|
| `/api/fireside/threads?repo=&slug=` | GET | **Public, no account** | The conversation under one post, and the count of what is on it. A signed-in reader also gets their own held comments, and that answer is `private, no-store` — the signed-out one alone is shared-cacheable, and both carry `Vary: Cookie`. |
| `/api/fireside/comments` | POST | Signed-in member | Write a comment. Answers with whether it is public yet and the held notice when it is not. |
| `/api/fireside/comments/[commentId]` | DELETE | Author | Withdraw your own comment. |
| `/api/fireside/comments/[commentId]` | PATCH | Author | Two things, by what the body carries: `body` rewrites the comment in place, `exportToBlog` turns the blog-export request on or off. |
| `/api/fireside/comments/[commentId]/reactions` | POST | Signed-in member | Leave or take back a reaction. |
| `/api/fireside/mine` | GET | Signed-in member | Your own comments, paged, each with its state. |
| `/api/fireside/search?q=&page=` | GET | Signed-in member | Search the conversation. Returns only what the caller may read — publicly visible comments plus their own held ones — paged, and says when it stopped looking so a narrower search can be run. |
| `/api/fireside/admin/comments?q=` | GET | Admin | Every comment, newest first, paged. Removed and withdrawn rows included, so anything already acted on can be found and undone. `q` searches the bodies. |
| `/api/fireside/admin/comments/[commentId]` | POST | Admin | Remove or restore a comment. |
| `/api/fireside/admin/threads` | GET | Admin | Every conversation, the one with the newest comment first, paged. Each carries its comment count, how many were removed or taken down, and when the last one arrived. |
| `/api/fireside/admin/threads/[threadId]` | POST | Admin | Close a conversation to new comments, or open it again. |
| `/api/fireside/admin/audit-events?limit=` | GET | Admin | The audit trail, newest first. `limit` is clamped to 500. |
| `/api/fireside/admin/export-queue` | GET | Admin | Pending blog-export requests, oldest first, paged, each with the author's record here. |
| `/api/fireside/admin/export-queue/[commentId]` | POST | Admin | Approve or decline one export request. Only a pending request can be decided; a refusal is final. |
| `/api/fireside/export` | GET | **Public, no account** | The comments the blog's published build may copy in, oldest first, read by cursor. Every row is decided by `mayExportToBlog`. |

## Data Model and Storage Contracts

Postgres, not a chat backend. Comments on posts are low-volume and asynchronous, and what they have
to be is durable, searchable, anchorable and exportable into a static build — none of which a
product priced on monthly active users provides, and this repository already carries a CI gate
about that quota.

| Table | Key columns | Notes |
|---|---|---|
| `fireside_threads` | `id`, `post_repo`, `post_slug`, `post_title`, `is_closed` | One per post, unique on `(post_repo, post_slug)`, created lazily on first comment. The blog holds hundreds of pages and most will never be commented on. |
| `fireside_comments` | `id`, `thread_id`, `parent_comment_id`, `author_user_id`, `author_username`, `body`, `edited_at`, `status`, `export_to_blog`, `export_review`, `export_reviewed_by`, `export_reviewed_at`, `export_refusal_reason`, `withdrawn_body`, `removed_by`, `removed_at`, `removal_reason` | `status` is `visible` / `removed` / `withdrawn`. `export_review` is `not_requested` / `pending` / `approved` / `refused`, constrained in the database: it holds the admin's half of the two keys on copying a comment to the blog, while `export_to_blog` holds the author's half. `author_username` is written at creation so the public read touches no identity table. `edited_at` is null until the author rewrites the comment and is what the "edited" mark is drawn from; the earlier wording is not kept anywhere, so there is no version history to read, export or delete. `withdrawn_body` is the author's own copy of a comment they took down and is returned by one query only — `listOwnComments`, scoped to the caller; the select behind the public thread read does not contain the column at all. Indexed by thread, by author, by `(export_review, created_at)` for the admin queue, and by a GIN index on `to_tsvector('english', body)` for search. That configuration has to match the one the query uses or Postgres quietly scans the entire table instead. |
| `fireside_reactions` | `id`, `comment_id`, `reactor_user_id`, `kind` | Unique on `(comment_id, reactor_user_id, kind)`, so pressing twice removes rather than duplicating. `kind` is one of the three reactions or one of the two votes, constrained in the database. A `downvote` row is stored and is never returned as a count: `FIRESIDE_COUNTED_KINDS` in `lib/fireside/constants.ts` has no such member, and every count is built from that list rather than from whatever the table happens to hold. |
| `fireside_audit_events` | `id`, `actor_id`, `command`, `policy_status`, `reason`, `target_type`, `target_id`, `result`, `metadata` | One row per write. |

**Public visibility is one rule in one place** — `lib/fireside/visibility.ts`. A comment is public
when its status is `visible` **and** its author is approved in Unlock. The two halves are separate
on purpose, and the file says why. Every caller reads it from there; nothing re-derives it. Four
faults in two weeks came from a rule written in two places that disagreed.

## Security, Privacy, and Compliance Controls

- Contracts: `FIRESIDE_PLUGIN_COMMAND_CONTRACTS.yaml`, `FIRESIDE_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`,
  `FIRESIDE_PLUGIN_AUDIT_CONTRACTS.yaml`, `FIRESIDE_PROFILE_AND_DELETION_CONTRACT.md`.
- **The public read is the one unauthenticated content route in the app.** It returns a display name
  and never a user id or an email, because everything on that shape is on the open web.
- **What a cache may keep depends on who asked.** The same route answers a signed-in member with
  their own held and removed comments, and the URL names only the post — so a shared cache holding
  that body would hand it to the next reader of that post. The signed-out answer alone is
  `public, s-maxage=60`; a signed-in answer is `private, no-store`; both send `Vary: Cookie`. One
  function, `firesideReadHeaders`, and its tests are the guarantee, because a cached body reaching
  the wrong reader looks like nothing at all from the inside.
- **Unlock exception, decided 2026-09-13** — the fourth, on the same reasoning as the Knowledge
  Library contribution exception. Recorded in `ctf/config/unlock-tier-exception-allowlist.json` and
  enforced by CI. Writing is a route into verification; reading is not gated at all and therefore is
  not an exception to anything.
- Every mutation carries the CSRF header and an origin check.
- Author-scoped updates match on `author_user_id` in the statement, never on a client-supplied id
  alone.
- **Editing is the Commons policy, and it is not a way around anybody else's decision.** The author,
  any time, with the new words checked exactly as the first ones were, so an edit cannot post what a
  fresh comment would have been refused for. It is refused on a comment an admin removed, on one the
  author took down, and in a closed conversation. A rewrite of a comment an admin had approved for
  the blog sends that approval back to the queue: the approval was given to the words, not to the
  row, and without this a rewrite would be a way to put any text at all into a permanently archived
  build under somebody's yes to something else.
- Deletion: same rights as the Commons, from the same account screen. Comments and reactions are
  deleted outright; threads and audit rows are retained and the deletion contract says why.
- A comment already exported into the blog build cannot be recalled from a web archive. Two separate
  people have to agree before one gets there: the author asks, which is off by default and nobody
  else can turn on, and an admin approves. Neither key does anything alone, an author can withdraw
  the ask at any point before the copy is made, and a refusal is final for that comment. The screen
  says all of this before the choice is made.
- The admin queue shows the author's own record here beside each request — comments written, removed,
  exports declined and approved — so an account that keeps doing this is answered once, by deleting
  the account, rather than chased comment by comment.
- Rate limit: 25 comments per person per day. A ceiling on how much one account can do in an
  afternoon before anybody looks at it, not a judgment about quality.

## Web and Android Delivery Status

- Web: the member screen (your own comments and the guidelines), the admin screen at
  `/admin/fireside` (blog export queue, every comment, the conversations, the audit log), and all
  thirteen route files. Phone-width, paged. Listed in the apps launcher at nav rank 260 — the row is in
  the `ctf_plugin_registry` seed in `schema.sql` and in migration `0016`, which is what the launcher
  actually reads. The admin screen has a row in the admin directory, with a "new to review" dot
  while an export request is waiting — counted by the queue's own function, so the dot and the
  screen it leads to always agree.
- The signed-out visitor view at `/apps/fireside`: shipped, as
  `components/fireside/fireside-public-shell.tsx`, registered in the public visitor registry. It
  sends the visitor to the blog first, because the conversation is already open to them, and asks
  for an account only for writing.
- The blog-side widget: shipped, and it lives in the `wiki-site` repository. It renders the
  conversation under each post for any reader, with no account, and hands off to the app to write.
  `/api/fireside/threads` answers it cross-origin (read-only, no credentials accepted, so a
  cross-origin caller always gets the signed-out view).
- The blog's half of the export: shipped, also in `wiki-site` — `scripts/src/sync-fireside-exports.ts`
  reads `/api/fireside/export` and writes a generated, committed `fireside-exports.ts` that the
  build bundles. Committed on purpose: a comment fetched into the page after it loads is not in the
  published build and so is not in what a web archive captures, which is the thing the author was
  asked to agree to. The section renders the build's copy first and the live read over it, so a
  reader with no JavaScript or a blocked app domain still sees the published conversation.
- Android: out of scope, web-only per rule 105. Recorded in `ctf/config/plugin-parity-contracts.json`
  with `requiresMobileSurface: false` — the native app carries only Clerk, Chyme, bug reporting and
  settings, and a conversation that lives under a blog post is not one of those.

## Seed Coverage Status

`ctf/scripts/seedFiresidePhase0.mjs` seeds one thread against a real published post and two comments
under it with deterministic ids, so the screens have something to render locally. It seeds no
reactions, no removed comment, and no pending blog-export request; all three are quick to make by
hand, and a seeded removal or a seeded request would put a decision in front of a reviewer that
nobody actually made. Seeded comments therefore start at `export_review = 'not_requested'`, which is
the column's default.

## Trust Signal

Recorded as **not applicable**, deliberately (rule 132). Participation here is writing about
trafficking and what was done to somebody. Surfacing that as public evidence of trustworthiness
would turn a person's account of their own harm into a score, which the rule forbids outright. A
member active only in Fireside is seen by being read, which is what the plugin is for.

## Gaps and Known Technical Debt

1. Writing from the blog page itself is not possible and is not planned: the write routes are
   same-origin with CSRF and origin checks, and a credentialed cross-origin form would break
   silently for anybody whose browser blocks third-party cookies. The button hands off to the app
   instead, which is where approval, moderation and deletion already live.
2. The author's record now carries one cross-plugin fact and not a cross-plugin tally. A platform
   restriction on the account shows on the export queue (2026-09-19), which is the app's own record
   of an account somebody has already acted on. What is still not there is a count of what the
   account did in each other plugin — that needs every plugin to expose a comparable tally, and
   `account_restrictions` only says that somebody already acted, not what the account did to earn it.
3. A member's search stops after 500 matches. Whether a comment is public depends on its author
   being approved in Unlock, which this plugin asks through the platform interface rather than in
   SQL, so the filtering happens after the database answers and an unbounded match set would mean
   an unbounded scan on a member-facing screen. The screen says when it stopped looking and asks
   for a narrower search rather than presenting a slice as everything. The admin search has no such
   ceiling, because it shows every comment whatever its state and needs no approval lookup.
4. The browse-every-conversation view is still not built, and is still the owner's decision
   (tabled 2026-09-13). Search answers a question somebody already has; browsing invites scrolling
   the room, which is a different thing to offer members.

## Change Log

- 2026-09-20: **A member can search the conversation, and nobody who was answered goes untold.**
  Owner request: close the last two recorded gaps.

  **Search was admin-only.** The comment bodies have been indexed since 2026-09-14 and only the
  moderation list read that index, which left a member as the one person who could not find a
  conversation they remembered being part of. Being searchable is one of the four reasons these
  comments are in Postgres rather than in a chat product, and a search only moderators can run does
  not deliver it to anybody the plugin exists for.

  `/api/fireside/search` is that, signed in, on the member's own Fireside screen. It returns only
  what the person searching may read — publicly visible comments plus their own held ones — decided
  by `isPubliclyVisible` rather than by a filter written again here. Signed in rather than public,
  unlike the read of one conversation: a public endpoint searching every comment in the app is a
  different thing from a public page of one post's thread, and it is not what was asked for.

  It is a search and not the browse-every-conversation view, which stays tabled and stays the
  owner's call. The screen shows nothing until somebody asks something: it answers a question
  already in a person's head, where a browse view invites scrolling the room. Searching is on
  submit rather than each keystroke, the page is in the address bar, and the count comes from the
  same filtered list the results do — the fault this plugin has already paid for twice.

  The scan stops at 500 matches and says so, recorded as a gap. Approval is not a column here, so
  the filtering happens after the database answers, and an unbounded match set on a member-facing
  screen would be an unbounded scan. Saying "there are more than this looked at, narrow it" is
  honest; showing a slice as though it were everything is not.

  **The catch-up no longer drops anybody.** It was capped at 50 replies when it shipped the day
  before, so a member approved after writing a great deal had the rest simply never mentioned to
  anyone. The cap and the pile-up it guarded against were the same mistake: counting replies
  instead of people. A flood only ever happens when many replies answer the *same* person, and one
  notice each removes it at the source — so the cap had nothing left to protect and is gone.
  `DISTINCT ON (parent.author_user_id)` collapses it in the database, so the work is bounded by how
  many people were answered rather than by how much was written, and the earliest reply to each
  person is the reference — a fixed choice, which is what keeps a re-run or a re-reviewed account
  silent. Five hundred people each answered once is five hundred people who should each hear about
  it, and none of them gets more than one.

  The notice says nothing about how many replies it stands for. A count there would be a fact about
  somebody's activity on a notification built to carry none, and the conversation itself is where
  that belongs. The audit row now records `firesidePeopleTold`, because the number an admin reads
  should mean what they would take it to mean.

- 2026-09-19: **A held reply tells the person it answered, once its author is approved. And the
  export queue can see an account the app has already acted on.** Owner request: work the recorded
  gaps. Two of the remaining ones, plus a record correction.

  **The notice that never arrived.** Nothing an unapproved member writes is publicly visible, so a
  reply of theirs notified nobody when they wrote it — telling somebody about a reply they would
  open and not find is worse than telling them nothing, which is the rule the write-time notice
  checks. The cost was that the notice never came at all: the member was approved later, the reply
  appeared, and the person it answered was never told. Their conversation quietly grew a reply while
  they were not looking, and the only way to find it was to go back to the post.

  Approval is the one moment that can be caught, and Unlock is the only code that knows it happened.
  So there is a new platform-owned crossing point, `lib/shared/unlock-approval-interface.ts`, in the
  same shape as `unlock-interface.ts` and for the opposite direction: the Unlock review route calls
  it and learns nothing about which plugins have work to do, and the plugins are reached through the
  one file `check-plugin-boundaries.mjs` permits to import them. Fireside's side is
  `announceHeldReplies`, which emits the same `fireside.reply` notice with the reply's own id as its
  reference — so `notifySafe` dedupes it and a re-reviewed account pings nobody twice. Only replies
  to somebody else's comment, only where that comment is still in the conversation, capped at 50 and
  recorded as a gap. Best-effort throughout and the decision is already committed before it runs: an
  admin approving somebody must never see that fail because a notification did. The run writes its
  own audit row, because it happened to somebody else's account.

  **The record beside an export request was one plugin's tally.** It exists so an admin can answer
  the account rather than the comment, and every number on it came from Fireside — so an account
  being a problem in several parts of the app at once did not appear here at all, and deleting an
  account on this screen's numbers would have missed it. `account_restrictions` is the app's single
  record of an account somebody has already acted on, wherever they acted, so the row now carries
  it: the scope in plain words, the reason if there is one, and a line saying the decision was made
  outside Fireside. It flags the row the same way a removal here does.

  Read with a new `getAnyAccountRestriction` rather than the existing status function, and the two
  are kept apart on purpose. The existing one answers "may this member do the thing they are
  attempting" and returns not-restricted when the stored scope does not cover that action; an admin
  needs the opposite, because somebody restricted from trading is not blocked from writing and is
  still an account that has been acted on. Reported, never enforced — this screen decides whether to
  publish words, not whether to allow an action.

  **A correction to the record.** This inventory said the blog's half of the export did not exist.
  It does: `wiki-site` carries `sync-fireside-exports.ts`, the generated `fireside-exports.ts`, and
  the conversation section renders the build's copy first and the live read over it. That was
  written before this repository could see the other one, and it was wrong. The blog's "edited" mark
  was a real gap and is fixed there, in `wiki-site` PR #256, along with the same orphaned-reply
  fault this app had.


- 2026-09-19: **The admin landing's "new to review" dot now counts what the queue shows.** Owner
  request, and it closes the gap recorded earlier the same day rather than leaving it. The dot was
  its own SQL count in `lib/admin/area-attention.ts` with the three column conditions on the row —
  the author asked, no admin has answered, the comment is still in the conversation — and no way to
  ask the fourth, which is that the author is approved in Unlock. So it lit up for a request the
  screen then dropped, and an admin who followed it read that the queue was empty. A signal that
  points at an empty screen teaches somebody to stop trusting it, which is worth less than no
  signal.

  The two ways to fix it were to write the approval rule into a second place in SQL or to let that
  shared map hold something other than SQL. The first is the fault this plugin already carries four
  incidents from, so it is the second: `AttentionQuery` gains a `{ count }` shape — a function
  taking the same last-seen timestamp — and Fireside's entry is now the queue's own
  `countPendingExportRequests`. Every other area's plain SQL string is untouched and still runs the
  way it did.

  Both halves of "what is in this queue" are written once as a result. The column conditions are
  `PENDING_REQUEST_WHERE`, interpolated by the count and the list; the Unlock half is
  `keepApprovedAuthors`, which both go through. The dot, the number above the list and the list
  itself are one answer asked three times.

  The `{ count }` shape is for a queue whose actionable set depends on something outside its own
  table, where the plugin already holds the function that decides. It is not an invitation to move
  the other areas off SQL, and the note in that file says so.

- 2026-09-19: **A read of the entire plugin, end to end, and what it turned up.** Owner request: close
  any gaps. Six things, no schema change and no new route.

  **The public thread read was telling shared caches to keep an answer that is different for every
  signed-in reader.** `/api/fireside/threads` went out under `public, max-age=30, s-maxage=60` —
  written for the signed-out case, where the answer really is the same for everybody. But that route
  also returns a signed-in member their own comments that nobody else may see: the ones held while
  they wait for Unlock, and the ones an admin took down. The URL names only the post, so "the next
  request for this URL" is any reader of that post, and `s-maxage` is an instruction to every shared
  cache in between to hand them the stored copy. The rule is now `firesideReadHeaders` in
  `lib/fireside/_lib.ts` and turns on whether the reader is signed in: the signed-out answer keeps
  the shared cache, a signed-in answer is `private, no-store`, and both carry `Vary: Cookie` so a
  cache holding the signed-out copy cannot serve it to a member either — who would otherwise read
  the conversation with their own held comment missing and conclude it had been thrown away. It is
  in the library rather than in the route file because Next.js refuses an unexpected export from a
  route, and a rule with no test is the kind that comes back.

  **A reply outlived the comment it answered and was rendered nowhere.** Taking a comment down drops
  it from the conversation entirely; an admin removing one leaves it visible to its own author and
  to nobody else. Either way the replies under it are untouched — still there, still public, still
  returned by the route — and the screen filed each one under a parent that was not in the list, so
  it drew nothing. One comment being taken out quietly took every answer to it out as well, and the
  people who wrote those answers watched their own words disappear from the thread. A reply whose
  parent is not on screen is now shown where the top-level comments are, with a line saying it
  answers a comment that is no longer shown.

  **A member's own held or removed comment looked exactly like a live one.** The inventory has said
  since the plugin shipped that somebody always sees their own words "with a label saying which",
  and on their own comments list they do. In the thread — which is the screen they are on when they
  write — there was no label at all, so a held comment read as public to the person waiting to be
  approved. The same missing knowledge is what put an Edit control on a comment an admin had
  removed, which the server then refused with a sentence about whose decision it was: honest, and a
  question the screen should not have had to ask. The comment shape now carries `viewerState`,
  populated from `commentStateForAuthor` and **only** for a row the viewer wrote — null on everybody
  else's and null for a signed-out reader, so no moderation state about anybody else travels on a
  shape returned by an unauthenticated route.

  **The export queue counted requests it would never list.** The count was plain SQL with the three
  column conditions; the list ran the same SQL and then dropped, in TypeScript, every request whose
  author is not approved. So a request from somebody still waiting on Unlock was counted and never
  shown — the screen read "1 of 3" over an empty list, and the page after it was empty too, because
  LIMIT and OFFSET had been spent on rows that were then thrown away. `readPendingExportQueue`
  replaces both functions: one scan of the pending set, one approval lookup, then the count, the
  clamp and the page all cut from the same filtered list, so the two cannot disagree again.

  **The count beside a post promised comments the same call had declined to give.** `findThread`
  counts every row that is not removed, which includes the ones held because their author is not
  approved. The blog widget renders that number under the post. It is now the number of comments the
  read actually returned.

  **The member's own comment list now puts its page in the address bar** (recorded gap 8), through
  the same `useUrlPage` every admin list here has used since it shipped. It was the last Fireside
  list paging without it.

  What was looked at and left alone: an author may still reply to a comment that was taken down,
  which costs nothing and reads no worse than a reply to a comment that has scrolled away; a thread
  is still created lazily from whatever repo and slug a member's first comment names, which is how
  the blog widget works and is not a thing to change without changing that too; and the admin
  landing's "new to review" dot was recorded as a gap rather than fixed, because the only ways to
  fix it were to teach a shared map of plain SQL queries to call a function or to write the Unlock
  approval rule into a second place, and this repository has already paid for that. The owner asked
  for it anyway the same day, so the first of those is what happened — see the entry above.

- 2026-09-18: **An author can rewrite their own comment** (owner report: correcting a typo meant
  removing the comment and posting it again). Taking a comment down and rewriting it loses the
  replies under it, the reactions on it and its place in the conversation, all to change one word,
  and the removal is permanent — so the correction cost more than the mistake. Fireside now carries
  the edit the Commons has had since it shipped: the author, any time, no window, the new words
  checked the way the first ones were, and an "edited" mark afterwards so changed words never read
  as the originals. The row keeps its id, so nothing under it moves. `PATCH
  /api/fireside/comments/[commentId]` takes a `body` alongside the export switch it already took;
  the rule about who may edit what is `refuseEdit` in `lib/fireside/visibility.ts` and nothing
  re-derives it. It refuses a comment an admin removed, one the author took down, and any comment
  in a closed conversation — each of those is somebody else's decision, and an edit is not the way
  to reverse it. New column `edited_at` on `fireside_comments`, migration
  `0028_fireside_comment_edit.sql`; no earlier wording is stored, so there is no version history to
  read or to delete. One knock-on worth naming: rewriting a comment an admin had already approved
  for the blog returns the request to the queue, because an admin approves words rather than a row,
  and a permanently archived build is not somewhere to discover that afterwards. The author is told
  that on screen at the moment it happens. The controls are on the member's own comment list and on
  the comment itself in the thread; the admin list marks an edited comment too, because a list that
  hides it is a list somebody moderates blind.

- 2026-09-17: **A signed-out visitor gets a real Fireside page** (owner report: the page was
  unenticing and described the feature wrongly). Fireside had no entry in the public visitor
  registry, so it fell through to `GenericPublicShell`, whose copy says the app has no public view
  yet and that signing in is what opens it. For Fireside both halves are false: the conversation
  renders under each blog post for any reader with no account, and an account is needed only to
  write. The new shell leads with a link straight to the blog, states the three things that make
  the conversation worth reading — open to read, never ranked, and still there in a year — and puts
  the account ask under writing, where it belongs. It shows no per-user data, which a signed-out
  shell cannot.

- 2026-09-16: **Fireside has an admin page** (owner report: there was none). Every admin power here
  already existed, and two of them had a screen — but that screen was a pair of buttons on the
  member's own Fireside page, so the plugin had no row in the admin directory and an admin looking
  for it found nothing. `/admin/fireside` is now the one place moderation lives, the same shape as
  every other plugin's admin page (rule 131), with four tabs: the blog export queue, every comment,
  the conversations, and the audit log. The member screen keeps the standard Admin pill in its
  header instead of the two buttons, and a member sees no pill at all.

  Two of the four tabs are new surfaces over routes that already existed or were one query away.
  **Conversations** lists every thread, the newest-commented first, with its comment count and how
  many were removed or taken down; closing a thread was reachable only from the post it belongs to,
  which means already knowing which post, and with hundreds of posts on the blog that is not a thing
  anybody can do at the moment they need to. Closed threads and threads whose comments have all been
  taken out are listed and labeled rather than dropped — an admin list hides nothing, and the thread
  most needed is usually the one something was already done to.

  **Audit log** reads `fireside_audit_events`, which every write in this plugin has been filling
  since it shipped while nothing in the app could read one back. The powers on this screen are
  taking somebody's words out of the conversation and agreeing to copy them onto a page a web
  archive keeps forever; a record of who did that, which nobody can read, is not a check on
  anything.

  Also here: the admin directory row carries the "new to review" dot when an export request is
  waiting, matched to the queue's own three conditions so it never points at a screen that then
  shows nothing; and the export queue now puts its page in the address bar, which closes half of
  recorded gap 6.

- 2026-09-14: **The comment bodies are indexed, and the moderation list searches them.** Being
  searchable is one of the four reasons these comments are in Postgres rather than in a chat
  product, and nothing indexed them — every search would have been a sequential scan that got
  slower for the rest of the app as the conversation grew. Cheaper before there is volume than
  after. A GIN index on `to_tsvector('english', body)`, and the query uses the same configuration,
  because a mismatch there is not an error: Postgres just does not use the index.

  `websearch_to_tsquery` rather than `to_tsquery`, because the input is typed by a person. It takes
  quoted phrases, `or`, and a leading minus the way a search box is expected to, and it cannot be
  made to throw by an unbalanced quote or a stray operator — `to_tsquery` throws on input as
  ordinary as `it's`. The search is passed as a parameter, never built into the SQL.

  Deliberately admin-only. A member-facing search across every thread is close to the
  browse-every-conversation view the owner tabled on 2026-09-13, so it is recorded as a gap and
  waits to be asked for rather than arriving as a side effect of indexing. Searching is submitted
  rather than run on every keystroke: each key would otherwise be a query against the entire table.

- 2026-09-14: **An admin can see every comment now, not just the export queue.** The queue answers
  one question — may this go on the blog — and it was the only admin screen, so removing or
  restoring a comment outside a thread meant knowing its id and calling the route by hand.
  `/api/fireside/admin/comments` lists everything newest first, paged, and the screen shows removed
  and withdrawn rows alongside live ones: a list that hides what was already acted on cannot be used
  to undo anything. A comment its own author withdrew carries no control, since restore is for admin
  removals only and a button that always fails is worse than no button.

  The page is in the address bar, which the accessibility rule in rule 100 asks for and which no
  Fireside list did before — put the page in the URL so it can be linked and the back button works,
  say which range of how many is on screen, and clamp an out-of-range page rather than showing
  nothing. `useUrlPage` is the first two: it reads `window.location` rather than `useSearchParams`,
  which would put a Suspense boundary requirement on a client shell rendered inside a dynamic route,
  and it writes with `history.pushState` so paging neither re-runs a server segment nor steps
  outside the screen on back. The clamp is the route's, which answers with the page it actually
  used, so a linked number past the end lands on the last page. The other two Fireside lists still
  page without the URL and are recorded as a gap.

- 2026-09-14: **Agree and disagree, which do not move anything.** Owner decision. The three
  reactions were the only way to answer a comment and there was no way to say plainly that you
  agreed. Both votes are stored in `fireside_reactions` alongside the reactions, so there is one
  mechanism rather than two.

  Two properties are the point of it and are enforced rather than described. **A vote never changes
  what order comments are read in** — the thread is ordered oldest first, no comment read joins or
  sorts on `fireside_reactions`, and `votes.test.ts` asserts both against the SQL the repository is
  built from. This is the inversion of the platform Fireside exists as an alternative to, where what
  gets read is decided by what was voted on, and it is the kind of promise that quietly stops being
  true unless something fails when it does. **No count of `downvote` is returned to anybody** — not
  the author, not a reader, not an admin. `FIRESIDE_COUNTED_KINDS` has no such member and every
  count is accumulated behind one `isCountedKind` guard, so a screen cannot show a total the server
  never sends. The person who left one still sees their own, because the control has to be able to
  show as pressed, and that is their own data rather than a tally of anybody else's.

  What a disagree should eventually do — cancel an agree, or be read only as feedback — is
  deliberately undecided (owner, 2026-09-14). A number on a screen would settle that by accident,
  which is why there is not one yet. Pressing one vote clears the other, since holding both says
  nothing. The three shipped reactions are untouched.
- 2026-09-14: **Taking your own comment down now asks first, and you keep your own copy.** Owner
  report, from the shipped screen: after withdrawing, the row read "Withdrawn." and nothing else, so
  the words were gone for the person who wrote them too — and there had been no confirmation, for an
  action no admin can undo. Both halves are the same problem. `fireside_comments` gains
  `withdrawn_body`; `withdrawOwnComment` copies `body` into it and then empties `body`, so what
  withdrawal means to everybody else is unchanged. It is copied from the row rather than taken as an
  argument, since a client-supplied body could put words in somebody's mouth on their own screen.

  The column is reachable from one query. `COMMENT_SELECT`, which feeds the public thread read, was
  split into shared columns plus a `FROM`, and only `OWN_COMMENT_SELECT` adds `withdrawn_body`;
  `listOwnComments` is its only caller and is scoped to `author_user_id = $1`. The guarantee is
  which select carries the column rather than a filter somebody has to remember, and
  `withdrawn-copy.test.ts` asserts exactly that — including that the blog export feed never selects
  it. Deleting the account still takes it, because that deletes the entire row.

  The confirmation names the two things that are actually irreversible — nobody can put the words
  back, and anything already copied into the blog's build stays there — rather than asking a bare
  "are you sure?". It uses `window.confirm`, which is what this repo already does for a destructive
  step in twenty-odd other places.
- 2026-09-14: **Fixed: the entire Fireside screen was hard to read.** Owner report, every section.
  Measured rather than argued, against the page background `#0F1117`:

  - The plugin had no entry in `PLUGIN_ACCENTS`, so `getAppAccent('fireside', …)` returned the
    neutral fallback gray `#6B7280` — 3.90:1, which fails. That accent paints every control on the
    screen: the export-queue button, the post-title link, Reply, the filled submit button. Most of
    why the page read as washed out is that its highlight color was gray. Fireside now has
    `#F4794F`, a lighter relative of the blog's own primary (`hsl(10 100% 40%)` = `#CC2200`, itself
    only 3.41:1 here). Same hue family, so the conversation looks like one thing in both places.
  - `t.FAINT` is 2.50:1 and was carrying real content: the "Showing 1–20 of N" count, and the note
    telling an author what state their export request is in. No text on these screens uses it now.
  - Half the text was 10–12px. One scale across all four components: nothing a member reads is
    under 13px, body copy is 15px at line-height 1.7.
  - Reading copy — the screen's description, the guidelines, the empty state, the export queue's
    description — was in the secondary gray. It is body color now. The secondary gray stays for
    what is genuinely secondary (author names, counts, loading), where it passes at 7.43:1.
  - The destructive red `#EF4444` was 4.57:1 on the card surface and lower on the tinted alert
    background it sits on. It is `#F87171` now, 6.22:1, in the same places.

  No layout, no copy and no behavior changed — this is color and type size only.
- 2026-09-14: **Closing a conversation is a route now, not just a function nobody could call.**
  `setThreadClosed` had been in the repository since the plugin shipped and nothing called it, so a
  thread listed as closable could not actually be closed by anybody without database access.
  `/api/fireside/admin/threads/[threadId]` is admin-gated, audited in both directions, and takes
  the same route to reopen — a conversation closed early should not need a migration to undo.
  Closing is deliberately not removing: everything already written stays where it is and stays
  readable, and the member-facing line says so rather than leaving somebody to conclude their
  comment was taken down. The comment box is hidden on a closed thread, because `createComment`
  already refuses there and a form that always fails is worse than no form. `FiresideThreadView`
  was split (the comment list is its own component) to stay inside the rule-116 length limit.
- 2026-09-14: **Somebody answering you now tells you.** Nothing did, so a reply sat unseen unless
  the person it answered happened to return to the post. It goes through the platform's own
  notification system rather than anything new — `notifySafe`, category `community`, deep-linked to
  that conversation with the repo and slug the rest of the plugin already passes around.

  Who gets told is a visibility question, so the rule lives in `visibility.ts` with the others and
  is tested there rather than sitting inline in the route. Three conditions. It has to be a reply, a
  new top-level comment answers nobody. The reply has to be publicly visible, because nothing an
  unapproved member writes is, and a notification about something the recipient opens and cannot
  find is worse than none. And nobody is told they replied to themselves, which in a conversation
  that has just started is most replies.

  Best-effort: `notifySafe` swallows its own failures, so a comment that saved never fails because
  the notification did. The summary names no content and no person, because it can land on a lock
  screen. A held reply does not notify late when its author is approved — that needs a hook into
  Unlock approval, which is a cross-plugin change, and it is recorded as a gap rather than
  pretended away.
- 2026-09-14: **The blog build can now read the comments both keys have cleared.** The two halves of
  the export decision had been recorded since 2026-09-13 and nothing read them, so no comment had
  ever left the app. `/api/fireside/export` is that feed: `listExportableComments` in
  `export-review.ts` runs every row it scans through `mayExportToBlog` and has no filter of its own,
  so neither key alone can let a comment out. The SQL narrows the scan for speed and is deliberately
  a superset of the rule — three of its four conditions, never the fourth — and if the rule is ever
  loosened that clause has to be widened first. Rows are dropped after the database returns them, so
  the feed is read by following a cursor rather than by counting: the cursor steps over what was
  scanned, not over what was kept, and a dropped row cannot cause a later one to be skipped. The
  route is public for the same reason `/api/fireside/threads` is — every comment it returns is
  already readable there one post at a time, and the caller is a static build with nowhere to keep a
  secret. The shape carries a display name and never a user id, because what it feeds is captured by
  web archives and cannot be pulled back. Its only caller is in `wiki-site`, which is why it is on
  the orphan-route allowlist as external.

  `FIRESIDE_PLUGIN_COMMAND_CONTRACTS.yaml` was also fixed while adding to it: two commands,
  `fireside.export.queue.read` and `fireside.export.approve`, had been appended after the
  `definitions:` block, which made the entire file invalid YAML — nothing in CI parses these
  contracts, so it had gone unnoticed since the day they were added. Both are back under
  `commands:` and `definitions:` is last. No wording changed.
- 2026-09-14: **The Fireside screen had no header and no way to the blog.** Owner report, from the
  shipped screen. Two separate things. It was built without `MobileScreenHeader`, so at phone width
  — the only width this web app renders — there was no back control at all, which rule 134 forbids;
  it now carries the same header, back chevron and top actions as every other screen. And nothing on
  the screen linked to the blog, so a member who opened Fireside before writing anything was told to
  "open a post on the blog" with no way to do it. A link sits beside the export-queue button and
  again in the empty state, pointing at `FIRESIDE_BLOG_BASE` — the blog root, which
  `FIRESIDE_BLOG_ARTICLE_BASE` is now derived from so the two addresses cannot drift apart. The
  in-thread "Back to the post" and "Back to your comments" links are untouched: they move between
  views inside one screen, which is not what the shared back control is for.

- 2026-09-13: **Fireside added.** Owner decision. Quora deletes this project's accounts as fast as
  they are made, and its comments are neither searchable nor bookmarkable, so the conversation that
  ought to follow a post has nowhere durable to live. This is that place: public to read, signed-in
  to write, and held from public view until the writer is approved. Built on Postgres rather than a
  chat backend for four reasons that a chat product cannot meet — durability, search, a stable
  anchor per comment, and being exportable into a static build — and because a service priced on
  monthly active users puts a ceiling on a public comment box. Three external options were weighed
  and rejected first: one keeps the platform dependency this exists to escape, one stores comments
  in public GitHub Discussions and so ties a survivor's identity to the repository, and one is
  another service to run that knows nothing about Unlock, the moderation panel or the deletion path.
  The fourth Unlock exception was decided the same day, on the Knowledge Library reasoning.

- 2026-09-13: **An admin now has to approve a comment before it can be copied into the blog's
  published build.** Owner directive. The author's own opt-in was the only condition, and one
  condition is not enough for a page that is permanently archived and sits beside the project's own
  writing: an account opened to post spam or bait could have put that text there and nobody could
  take it back. Two keys now — the author asks, an admin agrees, and neither alone does anything.
  A refusal is final for that comment, because a refusal that can be re-queued by toggling a switch
  is not a refusal. `fireside_comments` gains `export_review`, `export_reviewed_by`,
  `export_reviewed_at` and `export_refusal_reason`; `mayExportToBlog` gains the third condition and
  its tests cover every way the two keys disagree. The admin queue screen shows each author's record
  here — comments, removals, refusals, approvals — and flags an account with history, because
  answering a deliberate offender item by item is a race that cannot be won and deleting the account
  settles it once. The export-review functions live in `lib/fireside/export-review.ts` rather than
  the repository: that file is about the conversation, this one is about what leaves the app.

- 2026-09-13: **Fixed: Fireside had no tile in the apps list.** Owner report. The plugin was added to
  `fallbackPluginRegistry` in the code and not to the `ctf_plugin_registry` seed, and the launcher
  reads the table — the array is only a fallback for an empty table, which does not happen in
  production. Every route worked and no member could reach any of them. The row is now in the
  `schema.sql` seed and in migration `0016`, since an existing database is not re-seeded by
  `schema.sql` alone. `schema.demo.sql` was regenerated rather than hand-edited.
  `ctf/scripts/check-plugin-registry-seed.mjs` now fails the build on any plugin in the code registry
  with no seed row, as the job `plugin-registry-seed-gate`. A comment in `schema.sql` already warned
  about this and did not prevent it, because nothing read the comment.

- 2026-09-14: **Fireside has a front door.** Owner report: a reader sent from the blog to sign in
  would land on the app's home page, twenty-five tiles deep, with no sign of the conversation they
  clicked for — and a first-time visitor leaves rather than hunting for it. Three things were wrong
  and all three are fixed. The blog had no comment section at all, so the plugin could not be reached
  by anybody: `wiki-site` now renders the conversation under every post for any reader, and
  `/api/fireside/threads` answers cross-origin for it, read-only and without accepting credentials.
  The app could not be told which conversation to open, so `/apps/fireside` now takes the post's
  repo and slug and opens that thread on arrival. And the hosted sign-in page returned everybody to
  the home page regardless of where they came from; `withSignInReturn` carries an app-relative
  destination through it, refusing anything that is not a path on this app so the parameter cannot
  be used to send a member off-site.

  The page gate also moved from `approved_full` to `any_authenticated` for this one slug, via
  `pluginPageMinUnlockTier`. The API had been running at that tier since the exception was decided,
  while the page had not, so a member following the link met a "finish verifying" wall instead of the
  comment box — the opposite of an exception whose reason is that writing here is a route into
  verification. The call site is recorded in the allowlist under the same 2026-09-13 decision.

  Back means the post, for somebody who arrived from one. The blog carries more than 300 posts, so
  returning a reader to a list of their own comments — empty, for the first-timer this entire path is
  built for — loses them exactly as thoroughly as the home page did. Opening the same thread from
  inside the app keeps the old control, so arriving one way does not change what back means the
  other way. Folder-shaped slugs (the archive entries) are rebuilt segment by segment so the return
  address is the one they came from.

  `check-unlock-tier-exceptions.mjs` did not notice any of that, because it matched only a literal
  tier and this one arrives from a helper. It now treats any non-literal `minUnlockTier` as needing
  the same approval, which is what caught this change once the gate could see it.

## Build Checklist

1. Schema, migration `post/0015`, deletion-registry entry. Done.
2. The visibility rule as one pure function with unit tests. Done — 13 tests.
3. Repository, access gates, seven routes. Done.
4. Plugin registry, catalog, shell, the dynamic plugin page. Done.
5. Contracts, this inventory, the manual test script, the seed. Done.
6. ~~The comment widget in `wiki-site`.~~ Shipped 2026-09-14.
   piece and it ships from the other repository.
7. The job that copies opted-in comments into the blog build. Blocked by 6.
8. An admin queue screen for recent comments. Blocked by nothing; the route exists.
9. Full-text search over comment bodies. Blocked by nothing, and worth doing before volume.
