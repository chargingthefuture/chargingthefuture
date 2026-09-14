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
   label saying which.
7. **Replies, one level deep.** A reply to a comment, and no reply to a reply. Deeper nesting is
   unreadable at phone width, which is the only width this app has.
8. **Three reactions** — I recognize this, This helped, Same here. A fixed set rather than free
   emoji, so a count means the same thing on every comment.
9. **Take your own comment down,** at any time, with no admin involved. The words go; the row stays
   so a reply underneath keeps its parent.
10. **Ask for a comment to be published with the post.** Off unless the author turns it on. Turning
   it on asks; it does not publish. An admin reads the request before anything is copied into the
   blog's own build, where it is searchable and captured by the Internet Archive and where nobody,
   this project included, can withdraw it later. The screen says which state the request is in —
   waiting, approved, or declined — and the author can take the ask back at any point before the
   copy is made, approved or not.
11. **Your own comments in one list,** on the Fireside screen in the app, paged, each labeled live,
    held, removed or withdrawn.

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
5. **Close a thread** to new comments without removing what is already there.
6. Every write is recorded in `fireside_audit_events`, including both halves of an export decision —
   the author's request and the admin's answer — because that pair is what lets text leave the app
   for somewhere it cannot be recalled from.

## API Surface and Route Map

| Route | Method | Who | What |
|---|---|---|---|
| `/api/fireside/threads?repo=&slug=` | GET | **Public, no account** | The conversation under one post. A signed-in reader also gets their own held comments. |
| `/api/fireside/comments` | POST | Signed-in member | Write a comment. Answers with whether it is public yet and the held notice when it is not. |
| `/api/fireside/comments/[commentId]` | DELETE | Author | Withdraw your own comment. |
| `/api/fireside/comments/[commentId]` | PATCH | Author | Turn the blog-export permission on or off. |
| `/api/fireside/comments/[commentId]/reactions` | POST | Signed-in member | Leave or take back a reaction. |
| `/api/fireside/mine` | GET | Signed-in member | Your own comments, paged, each with its state. |
| `/api/fireside/admin/comments/[commentId]` | POST | Admin | Remove or restore a comment. |
| `/api/fireside/admin/export-queue` | GET | Admin | Pending blog-export requests, oldest first, paged, each with the author's record here. |
| `/api/fireside/admin/export-queue/[commentId]` | POST | Admin | Approve or decline one export request. Only a pending request can be decided; a refusal is final. |

## Data Model and Storage Contracts

Postgres, not a chat backend. Comments on posts are low-volume and asynchronous, and what they have
to be is durable, searchable, anchorable and exportable into a static build — none of which a
product priced on monthly active users provides, and this repository already carries a CI gate
about that quota.

| Table | Key columns | Notes |
|---|---|---|
| `fireside_threads` | `id`, `post_repo`, `post_slug`, `post_title`, `is_closed` | One per post, unique on `(post_repo, post_slug)`, created lazily on first comment. The blog holds hundreds of pages and most will never be commented on. |
| `fireside_comments` | `id`, `thread_id`, `parent_comment_id`, `author_user_id`, `author_username`, `body`, `status`, `export_to_blog`, `export_review`, `export_reviewed_by`, `export_reviewed_at`, `export_refusal_reason`, `removed_by`, `removed_at`, `removal_reason` | `status` is `visible` / `removed` / `withdrawn`. `export_review` is `not_requested` / `pending` / `approved` / `refused`, constrained in the database: it holds the admin's half of the two keys on copying a comment to the blog, while `export_to_blog` holds the author's half. `author_username` is written at creation so the public read touches no identity table. Indexed by thread, by author, and by `(export_review, created_at)` for the admin queue. |
| `fireside_reactions` | `id`, `comment_id`, `reactor_user_id`, `kind` | Unique on `(comment_id, reactor_user_id, kind)`, so pressing twice removes rather than duplicating. |
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
- **Unlock exception, decided 2026-09-13** — the fourth, on the same reasoning as the Knowledge
  Library contribution exception. Recorded in `ctf/config/unlock-tier-exception-allowlist.json` and
  enforced by CI. Writing is a route into verification; reading is not gated at all and therefore is
  not an exception to anything.
- Every mutation carries the CSRF header and an origin check.
- Author-scoped updates match on `author_user_id` in the statement, never on a client-supplied id
  alone.
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

- Web: the plugin screen (your own comments, the guidelines, and the export queue for an admin) and
  all nine routes. Phone-width, paged. Listed in the apps launcher at nav rank 260 — the row is in
  the `ctf_plugin_registry` seed in `schema.sql` and in migration `0016`, which is what the launcher
  actually reads.
- The blog-side widget: shipped, and it lives in the `wiki-site` repository. It renders the
  conversation under each post for any reader, with no account, and hands off to the app to write.
  `/api/fireside/threads` answers it cross-origin (read-only, no credentials accepted, so a
  cross-origin caller always gets the signed-out view).
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
2. Both halves of the export decision are recorded and nothing reads them yet. The job that copies
   approved, opted-in comments into the blog build is the next piece, and it belongs in `wiki-site`
   alongside the widget. It must read `mayExportToBlog` rather than either column on its own.
3. No general admin list of recent comments. The export queue is a screen, but removing or restoring
   a comment outside a thread still means calling the route by id.
4. The author's record counts only what happened in Fireside. An account being a problem in several
   parts of the app at once is not visible from this screen, and deciding to delete an account on one
   plugin's tally alone would miss that.
5. Closing a thread has a repository function and no route.
6. No notification when somebody replies to you.
7. Search is a Postgres table scan waiting to happen. Nothing indexes comment bodies yet, and the
   whole argument for storing them here is that they are searchable — worth doing before volume
   rather than after.

## Change Log

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
  returning a reader to a list of their own comments — empty, for the first-timer this whole path is
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
