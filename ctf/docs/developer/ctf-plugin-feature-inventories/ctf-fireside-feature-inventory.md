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
   unreadable at phone width, which is the only width this app has. When somebody answers you, you
   are told, and the notification opens that conversation. Nothing arrives for a reply you cannot
   see yet, and nothing arrives for replying to yourself.
8. **Three reactions** — I recognize this, This helped, Same here. A fixed set rather than free
   emoji, so a count means the same thing on every comment.
9. **Take your own comment down,** at any time, with no admin involved. The words go from the
   conversation; the row stays so a reply underneath keeps its parent. It asks before doing it,
   because it cannot be undone and no admin can put the words back. You keep your own copy of what
   you wrote, shown struck through on your screen and nowhere else — the moment somebody most needs
   to read what they wrote is just after they have destroyed it, when they are checking that they
   meant that one.
10. **Ask for a comment to be published with the post.** Off unless the author turns it on. Turning
   it on asks; it does not publish. An admin reads the request before anything is copied into the
   blog's own build, where it is searchable and captured by the Internet Archive and where nobody,
   this project included, can withdraw it later. The screen says which state the request is in —
   waiting, approved, or declined — and the author can take the ask back at any point before the
   copy is made, approved or not.
11. **Your own comments in one list,** on the Fireside screen in the app, paged, each labeled live,
    held, removed or withdrawn.
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
   The control is on the conversation itself, a member reads a line saying it is closed rather than
   being left to guess, and the comment box is not offered when writing would be refused.
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
| `/api/fireside/admin/threads/[threadId]` | POST | Admin | Close a conversation to new comments, or open it again. |
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
| `fireside_comments` | `id`, `thread_id`, `parent_comment_id`, `author_user_id`, `author_username`, `body`, `status`, `export_to_blog`, `export_review`, `export_reviewed_by`, `export_reviewed_at`, `export_refusal_reason`, `withdrawn_body`, `removed_by`, `removed_at`, `removal_reason` | `status` is `visible` / `removed` / `withdrawn`. `export_review` is `not_requested` / `pending` / `approved` / `refused`, constrained in the database: it holds the admin's half of the two keys on copying a comment to the blog, while `export_to_blog` holds the author's half. `author_username` is written at creation so the public read touches no identity table. Indexed by thread, by author, and by `(export_review, created_at)` for the admin queue. `withdrawn_body` is the author's own copy of a comment they took down and is returned by one query only — `listOwnComments`, scoped to the caller; the select behind the public thread read does not contain the column at all. |
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
2. The app's half of the export is built and the blog's half is not. `/api/fireside/export` answers
   with the comments both keys have cleared, and nothing in `wiki-site` reads it yet, so no comment
   has actually been copied into a build. The reader belongs there alongside the widget.
3. No general admin list of recent comments. The export queue is a screen, but removing or restoring
   a comment outside a thread still means calling the route by id.
4. The author's record counts only what happened in Fireside. An account being a problem in several
   parts of the app at once is not visible from this screen, and deciding to delete an account on one
   plugin's tally alone would miss that.
5. A reply notification does not arrive late. A held reply notifies nobody, and approving its
   author later makes the reply appear without telling the person it answered. Catching that up
   means hooking into Unlock approval, which is a cross-plugin change rather than a Fireside one.
6. Search is a Postgres table scan waiting to happen. Nothing indexes comment bodies yet, and the
   whole argument for storing them here is that they are searchable — worth doing before volume
   rather than after.
## Change Log

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
  it. Deleting the account still takes it, because that deletes the whole row.

  The confirmation names the two things that are actually irreversible — nobody can put the words
  back, and anything already copied into the blog's build stays there — rather than asking a bare
  "are you sure?". It uses `window.confirm`, which is what this repo already does for a destructive
  step in twenty-odd other places.
- 2026-09-14: **Fixed: the whole Fireside screen was hard to read.** Owner report, every section.
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
  `definitions:` block, which made the whole file invalid YAML — nothing in CI parses these
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
