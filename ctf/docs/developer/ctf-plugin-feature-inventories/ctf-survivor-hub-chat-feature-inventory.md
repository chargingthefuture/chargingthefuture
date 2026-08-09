# Survivor Hub Feature Inventory (CTF Rewrite)

## Consolidation Decision (2026-05-31): Survivor Hub absorbs Feed

> **This section supersedes any conflicting detail below until the line-by-line rewrite
> lands with the consolidation code PR.** Owner-locked decisions:
>
> 1. **Survivor Hub is the single app homepage** and absorbs the `feed-announcements`
>    plugin. `feed-announcements` is retired as a separately navigable app; its slug
>    (and the `feed` / `announcements` aliases) will alias into the Hub.
> 2. **One blended, publicly-viewable channel** (named `community`) interleaves three
>    content types in a single stream: **admin-only announcements**, **AI Q&A** (the
>    chat assistant), and **peer-to-peer community posts**. Community posts are the only
>    user-authored social surface in the product; public visibility is intentional
>    (soft moderation + marketing signal). Splitting into multiple Hub channels is a
>    possible future option, not the default.
> 3. **Data layer = the existing Feed backend** (`feed_items` projection model +
>    `lib/feed/inference.ts` Ollama Q&A). The previously-specified Hub-owned
>    `hub_channels` / `hub_messages` / `hub_bot_routes` tables and dedicated GetStream
>    scope described in this document are **dropped** — the Hub presentation shell reads
>    and writes the Feed model so there is a single source of truth. Per-user routing
>    moves from the hardcoded `getActionForText()` to Feed-backed data over time.
> 4. **Product stance:** deliberately not social media; minimize user-authored free
>    content; keep content economy-scoped.
>
> **Design:** the homepage UI already exists and is design-backed in the `design/`
> submodule (`mockups/survivor-hub/`: `FeedAnnouncements.tsx`, `HubPublic.tsx`,
> `Desktop.tsx`, mobile variants). The wireframes need a *modification* (not net-new
> design) to reflect the single blended public channel; the modification prompt is
> handed to the Replit design agent out-of-band (one-time use, not committed).
>
> **Ordered next steps (no phases; dependencies noted):**
>
> 1. Wire the Hub home channel to the Feed backend — replace stubbed `/api/hub/messages`
>    + hardcoded `getActionForText()` so the single channel reads/writes `feed_items`
>    (announcements + AI Q&A + community). Carries the `schema.sql` change for public
>    channel visibility, which also unblocks the seed-drift fix below (seed/schema gate).
> 2. Remove the phantom `feed_user_extension` references (seed `INSERT`, deletion
>    contract, Feed data-model) — resolves the long-pending feed 🟡 drift. Blocked by
>    step 1's `schema.sql` change (seed changes require a schema change per the gate).
> 3. Retire `feed-announcements` as a standalone app in the registry (alias into Hub).
>    Blocked by step 1 (don't orphan the route before the Hub serves the channel).
> 4. Reconcile contracts (point Hub commands at the `feed.*` namespace; mark stubbed
>    `HUB_*` contracts superseded). Blocked by step 1.
> 5. Mobile parity — wire the mobile Hub home to the same Feed-backed channel; update
>    `plugin-parity-contracts.json`. Blocked by step 1.

## Scope and Boundary

- Rewrite target only: `ctf/`. Legacy `platform/` is reference-only.
- Plugin slug: `hub` (the homepage at `/`; not a separately navigable app tile).
- Hub owns the unified Survivor Hub home/landing experience: app shell, the single blended
  `community` channel, live hero stats, and the plugin grid.
- Data layer: the Hub channel is backed by the Feed model (`feed_items` + `lib/feed/inference.ts`)
  as the single source of truth — see the Consolidation Decision above. The Hub does not own a
  separate message store, channel table, bot table, or dedicated GetStream scope.
- Cross-plugin runtime dependency is limited to read-only consumption of the platform GDP snapshot
  (hero stats) and the plugin registry (Apps grid). See [112-platform-architecture-rules.mdc](../../../../.claude/rules/112-platform-architecture-rules.mdc).

## Intent and Outcome

The Survivor Hub is the primary entry point of CTF for both unauthenticated visitors and authenticated survivors. It provides the home shell, one blended publicly-viewable `community` channel (interleaving admin-only announcements, AI Q&A, and peer-to-peer community posts), the live hero stats, and the plugin grid. Hub is the canonical "home" route at `/`; opening a plugin moves the user into that plugin's own scope. This is deliberately not social media: peer-to-peer posting is the only user-authored surface, kept economy-scoped. Separate channels, direct messages, and system bots are deferred (see Gaps) — the MVP is one channel.

## User Features

### Hub Shell

1. Four-column layout on `/apps`: icon rail (72px), left sidebar (240px), main content (flex), right rail (280px).
2. Section toggle between **Chat** and **Apps** controlled by icon rail buttons; section state is shell-local.
3. Right rail renders auth-provider username/display name for signed-in users and a sign-in CTA for unsigned visitors.
4. Right rail "About Survivor Hub" section with chat-first copy that points members to ask in the chat (no plugin-count framing).
5. Right rail no longer shows a "Ready/Active Apps" list (removed 2026-06-18) — apps are reached via the Apps section; the "· N ready apps" line was also dropped from the signed-in profile card.
6. Sign-in and Create-Account CTAs visible in icon rail and right rail for unsigned visitors.
7. Hero banner ("Free to join · End-to-end encrypted") visible to unsigned visitors.
8. Signed-in members see the product name "Skills Economy" beside the brand mark in the phone top bar, set on two short lines so it fits the narrowest phone. Signed-out visitors keep the single-line "SE / SKILLS ECONOMY" lockup.
9. The phone-width top bar switches sections with two icon buttons — a speech-bubbles icon for the Commons and a grid icon for Apps — the same 38px square as the admin, help and settings buttons beside them, so the whole bar is one row of equal boxes. Each button names itself for screen readers and on hover ("Commons", "Apps"). Once a member is there, the page says which one it is: the Apps page heads "All Apps", and the Commons channel row starts with the word "Commons" ahead of the `#general` chip.

### Hub Chat (the blended `community` channel)

1. Hero banner with live stats from the platform-owned GDP snapshot table: member count, GDP value (USD), opportunity value (target GDP minus current GDP).
2. Hero banner copy adapts: "Welcome to Survivor Hub" for unsigned visitors; "Good morning, {displayName} — your network is active." for signed-in users.
3. One blended stream interleaving admin-only announcements, AI Q&A answers, and peer-to-peer community posts. History loaded via `GET /api/hub/messages` (backed by `listFeedTimeline` over `feed_items`), polled while the shell is mounted.
4. Sending from the input creates a peer-to-peer community post via `POST /api/hub/messages` (backed by `createFeedCommunityPost`, CSRF-guarded); dedup on display by `(from, sender, text, time)` tuple.
5. AI Q&A uses the Feed inference pipeline (`lib/feed/inference.ts`, consent-gated). The hardcoded `getActionForText()` keyword routing has been **removed** (2026-07-16): it was wrongly attaching an "Open <Plugin>" action button to any peer post whose body happened to contain a keyword like "economy"/"housing", making it look as if the author had linked a plugin. Action buttons now come only from an explicit source — the local concierge reply sets its own `actionLabel`/`actionSlug`; a peer community post never carries an inferred action, and members cannot attach one.
6. One-tap suggestion chips render persistently above the composer (whether or not the chat already has messages). Each chip's behavior is explicit (`lib/concierge/hub-suggestions.ts`), so a tap always does the right thing and never merely pre-fills the composer (#471): a **navigate** chip ("Show housing options" → LightHouse, "Open the provider directory" → Foundation, "Browse the skills directory" → Directory, "Check my Service Credits" → ServiceCredits) opens that plugin directly (`/apps/<slug>`) — it is an action, not a question; an **ask** chip ("What is the GDP tracker showing this week?") routes the question to the `@comic` AI assistant via `askComic`, which prepends the `@comic` mention (the server only routes a mentioned body) and shows the "Reviewing for safety" pending card immediately, then the human-approved answer when it is ready. The local keyword concierge (`lib/concierge/resolver`, `sendConciergeAsk`) remains available for free-text asks but no longer backs the visible chip row.
7. Announcements render as official Survivor Hub items; community posts render with their author.
8. Connection state visible as footer status (connecting, live, fallback).
9. Unsigned visitors see a sign-in gate in place of the input; the channel itself is publicly readable when `feed_render_config.is_public` is TRUE (public read enforcement is a tracked follow-up). The gate is one short line under the posts explaining that signing in — free — is what lets you post, reply, and reach housing, work, and safety resources. It carries no button of its own: signing in is the "Sign in" button in the top bar (and the outline "Sign In" in the right rail on wide screens), so the hero, the posts, and that line fit on one screen (2026-08-03).
10. Signal-style quoted reply: each peer message shows a small "Reply" affordance. Tapping it sets the composer's "Replying to …" banner (a one-line quote preview + cancel X); sending while it is set posts the message with `replyToPostId` so it stores and renders a compact quoted block (author + ~120-char snippet) above its body. Backed by `feed_community_posts.reply_to_post_id`; the quote is resolved server-side into `HubMessage.quotedMessage`.
11. Unread divider: on entry the chat reads the member's `feed_hub_last_seen` marker (`GET /api/hub/last-seen`) and draws a single "New messages" divider before the first stream entry newer than it (none if everything is already seen). After the member has viewed the chat it marks seen once (`POST /api/hub/last-seen`, debounced/best-effort). Placement uses the per-entry `epoch` already computed for the unified stream.
12. Emoji reactions: under each peer bubble a compact reaction row shows any emoji with at least one reaction as a pill (emoji + count, highlighted when the member reacted), plus a small "add reaction" affordance that reveals a fixed quick set (👍 ❤️ 😂 🎉 🙏 😢) to pick from. Tapping a pill or a picker emoji toggles the member's reaction (`POST /api/hub/messages/:postId/reactions`), flips it optimistically, and reconciles via the existing 10s poll. Reactions are stored in our own database (`feed_community_post_reactions`), not Stream — the first feature of the Stream-adoption initiative ("approach b").
13. Live Stream layer (the real-time foundation, kept beneath the custom Commons design — task 1 of `STREAM_FEATURE_ADOPTION.md`): on entry the shell calls `POST /api/hub/join`, which now mints real Stream credentials for the shared `ctf-feed-community` channel (`getFeedStreamCredentials(userId, displayName, 'community')`). The client opens a `stream-chat` connection to that channel and subscribes to events. A `message.new` event (or a recovered connection) triggers the existing `refreshHistory()` so new posts appear immediately instead of waiting for the poll; the 10s poll stays as a backstop but slows to 30s while the live connection is healthy. The connection is disconnected on unmount. Every part of this is best-effort: when Stream is not configured (`POST /api/hub/join` returns `{ ok: true, configured: false }`) or any live step fails, the client silently stays on the 10s poll and the chat is fully functional — the live layer never breaks Commons.
14. Typing indicator (live only): as the member types in the composer the client emits typing events on the live channel (`channel.keystroke()`); incoming `typing.start` / `typing.stop` events surface a subtle "X is typing…" line above the composer, on-brand with the dark design (two names read "X and Y are typing…"; more collapse to a count). The line clears on send and is absent in polling-only mode.
15. Delete your own post: each of the member's own peer bubbles carries a small "Delete" affordance (a trash action beside "Reply"; web confirms with a dialog, Android with a destructive `Alert`). Confirming calls `DELETE /api/hub/messages/:postId`, optimistically drops the post from the stream, and restores it on failure. There is deliberately **no edit** — to change a post a member deletes it and posts again, so a corrected message is a fresh row with its own moderation and no inherited reactions/replies (the anti-fraud choice over in-place edit; owner decision 2026-07-16). Author-only; the server rejects deleting anyone else's post.

### Sidebar — Channels (deferred)

- The MVP is a single blended `community` channel; there is no `hub_channels` table and no multi-channel sidebar. Splitting into multiple Hub channels is a possible future option pending feedback (see Gaps). Stubbed `GET /api/hub/channels` returns a single `community` channel.

### Sidebar — Direct Messages (deferred)

- Direct messages are out of scope for the consolidated MVP — peer-to-peer interaction happens only in the public blended channel (intentional, for soft moderation and marketing visibility). There is no `GET /api/hub/dms` route and no `hub_dm_threads` table.

### Sidebar — Bots (deferred)

- There is no `hub_bots` / `hub_bot_routes` system-bot entity in the MVP. The assistant capability is the Feed AI Q&A — now built as the `comic` subsystem (`@comic` mention; user-facing label "AI Assistant"), specified in `ctf-comic-feature-inventory.md` (the source of truth for the AI assistant). `GET /api/hub/bots` used to answer here with a hardcoded empty list that nothing read; it was removed on 2026-08-03 rather than left standing as a capability that did not exist.

### Hub Apps (Apps Section)

1. Three-column plugin grid driven by the platform-owned plugin registry (`GET /api/plugins`).
2. Per-plugin color theme and emoji from `shell-plugin-config.ts`.
3. Sort modes: **recent**, **alphabetical**, **most-used**. Selection persists in `localStorage` (`ctf.communityShell.pluginSortMode`).
4. Recent-use tracking persists in `localStorage` (`ctf.communityShell.recentPluginSlugs`); capped at 12 entries.
5. Most-used tracking persists in `localStorage` (`ctf.communityShell.pluginUsageCounts`).
6. Both counters are recorded when the member opens a plugin from a card's "Open plugin →" link. Tapping the card body only highlights it and is not counted as a use.
7. Search filters by name and summary. The search box sits in the apps grid header, not the sidebar.
8. Cards link to `/apps/[slug]` for each plugin.

## Admin Features

1. Announcement authoring (admin-only) and channel config (enabled channels, `is_public`) are operated through the Feed admin surface at `/admin/feed-announcements` and the `feed.*` command namespace — the Hub has no separate admin contract surface.
2. There is no bot or channel-visibility admin surface in the MVP (deferred with channels/DMs/bots).

## API Surface and Route Map

The Hub home channel is backed by the Feed model. Hub routes under `/api/hub/*`:

- `GET /api/hub/messages` — blended channel history, backed by `listFeedTimeline` over `feed_items` (announcements + AI Q&A + community), mapped to the `HubMessage` contract. Returns `channelId: 'community'`. Each peer message now carries `communityPostId` (the underlying post id — the reply target), `quotedMessage` (`{ author, snippet }`, resolved server-side) when the post is a Signal-style reply, and `reactions` (`{ emoji, count, reactedByMe }[]`, the emoji-reaction aggregate resolved for the requesting member; `[]` for non-community messages). Every message also carries `kind` (`announcement` | `question` | `community`) and `title` (the announcement heading, split out of the body server-side; `null` otherwise) so the client can render an announcement as the distinct official card rather than a chat bubble. Accepts an optional `mentions=me` query param (the "@ Mentions" toggle): the server derives the caller's handle forms (`@<username>` and the `@user-<id token>` pseudonym) from the authenticated session — never from client input — and returns only community-channel messages whose body contains one of them (case-insensitive, parameterized/escaped `ILIKE`). Also accepts an optional `channel=announcements` query param (the 📣 filter chip): the server returns only official announcements — including ones that scrolled off the recent page — so a member with limited message history can still surface them. Only `announcements` is honored (anything else falls back to the full blended stream); `mentions=me` takes precedence when both are present. Also accepts optional `aroundPost=<community-post-id>` / `aroundAnnouncement=<announcement-id>` query params (a notification's "Open" deep link): the server returns a page centered on that item — its rank among newer items under the same visibility filters, offset back half a page — so a message older than the recent page still lands. These apply only to the unfiltered stream (ignored under `mentions=me` / `channel=announcements`); an unknown/deleted id falls back to the normal recent page.
- `POST /api/hub/messages/:postId/reactions` — toggle the requesting member's emoji reaction on a community post (hub access gate + `x-ctf-csrf: '1'`). The `postId` path segment must be a well-formed UUID, else 400 before the repository is called. Body `{ emoji }`; the emoji must be in the fixed quick set, else 400. A second toggle of the same emoji removes it. Returns `{ ok, reacted }`. Backed by `toggleCommunityPostReaction` over `feed_community_post_reactions` (our own database, not Stream).
- `POST /api/hub/messages` — create a peer-to-peer community post, backed by `createFeedCommunityPost` (CSRF-guarded; rate-limit + moderation honored). Body accepts an optional `replyToPostId` (the quoted post's id) plus a display-only `quotedMessage` echoed back on the created message so the sender's optimistic copy renders the quote. An unknown/malformed `replyToPostId` is rejected with 400.
- `DELETE /api/hub/messages/:postId` — delete the requesting member's own community (peer) post (hub access gate + `x-ctf-csrf: '1'`). The `postId` path segment must be a well-formed UUID, else 400 before the repository is called. Author-only: backed by `deleteCommunityPost`, which verifies the caller owns the post (else 403), then hard-deletes it — cascading its replies + reactions and removing the projected `feed_items` row (with its targets, read state, and dismissals). Returns `{ ok, postId }`; 404 if the post is gone. There is no edit endpoint by design: a member corrects a post by deleting and reposting, so a corrected message is a fresh row with its own moderation and no inherited reactions/replies (closes the bait-and-switch edit vector).
- `GET /api/hub/last-seen` — read the member's last-seen marker for the Hub home channel (`{ ok, lastSeenAtIso }`); `lastSeenAtIso` is null when never recorded. Backed by `getHubLastSeen` over `feed_hub_last_seen`. Best-effort.
- `POST /api/hub/last-seen` — move the member's last-seen marker to now (CSRF-guarded; optional `seenAtIso` clamped to server NOW() and never moved backwards). Backed by `updateHubLastSeen`. Best-effort.
- `GET /api/hub/channels` — the channel list the Commons shell reads. Returns `#general` for everyone,
  plus the gated contributor channel when it is open and this member is eligible (or is an admin) —
  filtered server-side so a non-eligible member's response contains no trace of it. Multi-channel
  beyond that is deferred.
- `POST /api/hub/join` — mints the live Stream credentials for the Commons home shell. Backed by `getFeedStreamCredentials(userId, displayName, 'community')` (the shared `ctf-feed-community` channel). Returns `{ ok: true, configured: true, streamApiKey, streamChannelId, streamUserId, streamToken }` when Stream is configured, or `{ ok: true, configured: false }` when it is not (no API key/secret) so the client stays on polling. Hub access gate enforced. Previously returned hardcoded stub credentials (`'todo-stream-token'`); the stub is removed.

Feed routes that own the data layer remain under `/api/feed/*` (timeline, announcements lifecycle, questions/answers, community posts/replies) and `/admin/feed-announcements`.

Web entry routes:

- `GET /` — Survivor Hub home page (Next.js `app/page.tsx`, `CommunityShell` chat section).
- `GET /apps` — Hub home, Apps section (`app/apps/page.tsx`).

## Data Model and Storage Contracts

The Hub owns no message/channel/bot tables. Its channel is backed by the Feed schema (canonical in `ctf/schema.sql`):

- `feed_items` — the blended timeline projection (`item_type` ∈ announcement | question | community).
- `feed_community_posts` / `feed_community_replies` — peer-to-peer posts. `feed_community_posts.reply_to_post_id` (nullable self-reference, `ON DELETE SET NULL`) records a Signal-style quoted reply between two peer posts.
- `feed_hub_last_seen` — per-member "last seen" marker for the Hub home channel (`user_id` PK, `last_seen_at`). Drives the single "New messages" divider in the Commons chat; read on entry, updated after viewing. Best-effort; a failure never breaks the chat.
- `feed_community_post_reactions` — emoji reactions on community posts (`id` PK, `post_id` → `feed_community_posts.id` `ON DELETE CASCADE`, `user_id`, `emoji`, `created_at`). Unique on `(post_id, user_id, emoji)` so a reaction toggles; indexed by `post_id` for the batched aggregate read. Stored in our own database (not Stream). Read into `HubMessage.reactions` by `listFeedTimeline`.
- `feed_questions` / `feed_answers` / `feed_answer_ratings` — AI Q&A and ratings.
- `announcements` (+ revisions/state) — admin-only announcements.
- `feed_render_config` — global singleton; `is_public BOOLEAN NOT NULL DEFAULT TRUE` marks the blended channel publicly viewable; `enabled_channels` gates rendering.

Platform-neutral tables consumed read-only by the Hub shell:

- `gdp_metric_snapshots` (platform-owned) — hero stats source.
- Plugin registry table behind `GET /api/plugins` (platform-owned) — Apps grid source.

The previously-specified `hub_channels` / `hub_bots` / `hub_bot_routes` / `hub_dm_threads` / `hub_messages` tables are dropped and not created.

## Security, Privacy, and Compliance Controls

1. The blended `community` channel is publicly readable (read-only) to unauthenticated visitors when `feed_render_config.is_public` is TRUE; posting/asking requires a valid auth-provider session. Public-read enforcement on the read path is a tracked follow-up (see Gaps).
2. Mutating Hub routes (`POST /api/hub/messages`) require a valid session and pass the Feed CSRF check (`x-ctf-csrf` + same-origin); reject with `401`/`403` otherwise.
3. Approved-user / admin gate (`requireHubAccess`) enforced on the channel send path; community posting honors Feed moderation and rate limits.
4. Announcements are admin-only (authored via the Feed admin surface); no other user can author announcements.
5. Identity handles for any `@mention` semantics use the canonical auth-provider username/handle per `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`.
6. AI Q&A runs through the Feed inference pipeline (`lib/feed/inference.ts`), which is consent-gated and audited in `llm_inference_log`.
7. Right rail renders `displayName` derived from auth provider, never hardcoded names; falls back to `Survivor` when no display name is available.
8. Hero stats come from `gdp_metric_snapshots`; render zero/absent when data is missing.

## Web and Android Delivery Status

- Web: the home shell renders at `/` (`CommunityShell`) with the channel backed by the Feed model. Web delivery for the consolidated channel is in place.
- Android: **surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). (Note: the native Commons/Chyme surface that remains on Android is covered by the Chyme inventory, not here.) Historical detail follows. The mobile home (`ctf/packages/mobile/src/features/hub/`) read the blended
  channel from `GET /api/hub/messages` (the same feed-backed timeline the web Hub uses, flattened to
  the `HubMessage` shape) and sends a peer-to-peer community post via `POST /api/hub/messages` with
  the `x-ctf-csrf: 1` header, mirroring the web CSRF handling. `HubHome` is the default surface in
  the mobile app shell. Announcements render with the official Survivor Hub treatment; community
  posts render with their author. The dead GetStream-based survivor-hub-chat mobile fixtures were
  removed. The single AI Assistant (`@comic`) surfaces — answer cards, the "Reviewing for safety"
  pending card, the `@comic` composer, consent, and ratings — are delivered separately in the comic
  Android parity work (see `ctf-comic-feature-inventory.md`). The live Stream layer is now at parity
  too (#730): `HubHome` opens a best-effort `stream-chat` connection to `ctf-feed-community` via
  `POST /api/hub/join` for instant new-post updates and a typing indicator, and falls back to the 15s
  poll when Stream is not configured or the connection fails.
- Public unauthenticated read of the blended channel is **not** part of this Android pass: like web,
  `GET /api/hub/messages` still requires a signed-in session. As of 2026-06-09 the Hub routes use the
  `support_only` access tier, so both fully-approved members and not-yet-verified `locked_support_only`
  members may read and post here — the general channel is the support surface for members still in the
  Unlock flow. The public unauthenticated read path is a separate, security-sensitive follow-up (see
  Gaps #1).

Delivery: **web + mobile-responsive complete**. **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA).

## Seed Coverage Status

There is no `seedHub.mjs`; the Hub channel's data layer is seeded by the Feed seed `ctf/scripts/seedFeedAnnouncements.mjs` (announcements, feed items, render config including `is_public`, community/question fixtures). The dropped `hub_*` tables are not seeded.

## Gaps and Known Technical Debt

1. Public unauthenticated read of the blended channel: `feed_render_config.is_public` is set and read into config, but `GET /api/hub/messages` / `listFeedTimeline` still require an authenticated session. A public read path (and the policy for which item types are exposed publicly) is the tracked follow-up.
2. Mobile Hub parity: delivered. The mobile home reads/writes the feed-backed channel via `GET/POST /api/hub/messages` (`ctf/packages/mobile/src/features/hub/`). The parity contract reconciliation was done on the existing `feed-announcements` entry (its `mobileFeatureDirs` now includes `hub`) rather than a standalone `hub` contract entry, because the web/Android parity gate requires every contract slug to exist in the plugin registry and the Hub is the home route (`/`), not a navigable app tile with its own registry slug.
3. Separate channels, direct messages, and system bots were dropped from the MVP (single blended channel). Revisit splitting into multiple Hub channels after feedback.
4. ~~`GET /api/hub/channels|dms|bots` are stubs (single-channel / empty); they can be removed or formalized when/if multi-channel returns.~~ **Closed (2026-08-03).** The description was out of date on all three counts: `/api/hub/dms` never existed; `/api/hub/channels` is not a stub (it is read by the Commons shell and does the real eligibility filtering for the gated contributor channel); and `/api/hub/bots` was a hardcoded empty list nothing called, so it was removed along with its `HubBotInfo` / `HubBotsResponse` types. Nothing to formalize until multi-channel actually returns.
5. Live-layer follow-ups deferred from the foundation pass (task 1): read receipts (#18) and delivery status (#19) are not implemented in Commons — Commons messages live in our own `feed_community_posts`, not as Stream messages, so "seen"/"delivered" would need a separate model and are deferred. Online presence dots on peer avatars (#20) are also deferred: avatars are keyed by our own author identity, and the watched channel's `presence` set is keyed by Stream user ids (`feed-<userId>`), so mapping presence onto our cards is not clean enough to force in the foundation pass. Typing (#17) is delivered (web and now Android, #730); these three are tracked for the presence cluster (task 6). The same three (read receipts, delivery status, presence dots) are likewise deferred on mobile to match web.

## Change Log

- 2026-08-09: **All Apps sort had nothing to sort by, so Recent and Most Used both showed A-Z
  (owner report).** The two counters that drive those orderings were only written by
  `handleAppSelect`, which fires when a member taps a card body — and a card tap only highlights
  the card, it does not open anything. The control a member actually uses, the card's
  "Open plugin →" link, called `stopPropagation()` and recorded nothing. So
  `ctf.communityShell.pluginUsageCounts` and `ctf.communityShell.recentPluginSlugs` stayed empty in
  normal use, both modes fell through to their alphabetical tie-break, and all three sort options
  produced the same order — the sort control looked dead even though it was applying. Recording now
  happens on the link, in a new `handleAppOpen` passed down to `ShellAppsPanel` as `onAppOpen`;
  `handleAppSelect` is left as highlight-only so a tap no longer inflates a plugin's count. The two
  `localStorage` writes also moved out of the `setState` updater callbacks they were nested in, so
  a double-invoked updater under React strict mode in development cannot write the count twice. No
  route, schema, or contract change; web-only (the native app has no apps grid).
- 2026-08-09: **Even spacing across the phone top bar, and the product name is back on it for
  signed-in members (owner report, follow-up to the icon tabs below).** Three different gaps ran
  across one row of identical squares: `.mobileBar` used 5px, `.mobileBarSections` used 4px between
  the two section tabs, and `.mobileBarAuth` had no gap at all, so help, settings and the avatar sat
  flush against each other. All three are 5px now. The avatar was also sitting 4px low: the shared
  `.clerkAvatarSlot` carries `margin-top: 4px` for the vertical desktop icon rail, where it separates
  the avatar from the button above it; that margin is reset to 0 inside `.mobileBarAuth`, where the
  controls sit side by side. Second, turning the section tabs into icons freed room beside the brand
  mark, so the signed-in bar shows the product name again instead of the mark alone. It is not the
  signed-out lockup: measured in Chromium at the app's own Inter, that lockup is 85px wide and an
  admin on a 375px phone has only 65px to spare. Setting the two words on their own lines
  (`.mobileBarWordmarkStacked`, 8px uppercase) is 50px and fits with room left at every phone width —
  verified at 360, 375, 393, 430 and 560px, with and without the admin button, the wordmark never
  shrinking below its full width and nothing reaching the right edge. The single-line "SE / SKILLS
  ECONOMY" lockup is untouched for signed-out visitors, whose bar carries no admin, help, settings or
  avatar and has the width for it. Web-only (the Commons is web-only per rule 105); UI only — no
  backend, schema, route, or contract change. Verified: `@ctf/web` typecheck, lint, and a production
  build.
- 2026-08-09: **One row of equal boxes in the phone top bar, and the Commons page says its own name
  (owner report).** The "Commons" and "Apps" section tabs were word buttons sized by their text
  (`padding: 6px 9px`), so they stood noticeably shorter than the 38px square admin, help and
  settings buttons next to them and the bar read as two mismatched rows. Both tabs are icons now
  (`MessagesSquare` for the Commons, `LayoutGrid` for Apps, from `lucide-react`) in the same 38px
  square with the same surface, border and radius, so every control in the bar matches. Nothing is
  lost by dropping the words: each button keeps an `aria-label` and a hover title, `role="tab"` and
  `aria-selected` are unchanged, and each destination announces itself on arrival — the Apps page
  already heads "All Apps", and `ChannelSwitchRow` now leads with a plain "Commons" label before the
  `#general` chip (new `.channelSwitchBar` wrapper carrying the row's padding, plus
  `.channelSwitchPageLabel`, deliberately without pill chrome so it does not read as a tappable
  channel). The label sits outside the `role="tablist"` element, so screen readers still count only
  the real channel tabs. Also hyphenated the composer helper line to "AI Assistant
  (human-in-the-loop)", matching the spelling every doc and contract already uses. Web-only (the
  Commons is web-only per rule 105); UI and copy only — no backend, schema, route, or contract
  change. Verified: `@ctf/web` typecheck, lint, and a production build.
- 2026-08-09: **The Weavers of the Commons explainer is usable from the keyboard now (#2159).** That
  dialog — shown when a member taps the locked contributor chip — declared `role="dialog"` and
  `aria-modal="true"` but did none of what those promise. Focus stayed on the page behind it, Tab
  walked straight out into content the member could no longer see, Escape did nothing, and closing
  the dialog dropped focus at the top of the document instead of returning it to the chip. It now
  moves focus into the card on open, cycles Tab and Shift+Tab within it, closes on Escape, and
  restores focus to whatever opened it. The trap itself moved out of `comic-consent-modal.tsx` into a
  new `dialog-focus.ts` so both dialogs share one copy rather than each carrying its own; the consent
  dialog's behavior is unchanged. Web-only; no schema, route, or contract change.
- 2026-08-09: **Return on "Not now" no longer turns the AI Assistant on (#2158), plus two smaller
  Commons fixes (#2156, #2160).** The first-use consent dialog for the AI Assistant treated Return as
  "turn it on" no matter what had focus. That rule exists for a real reason — on a phone the soft
  keyboard keeps focus in the chat composer, and without it a press of Return fell through to the
  composer and re-opened the same dialog instead of answering it. But it also meant a member using a
  keyboard could tab to "Not now", press Return, and grant consent to AI processing instead of
  declining it. Return now leaves the press alone whenever a button inside the dialog already has
  focus, so the browser fires that button's own click — "Not now" and the close button dismiss, the
  confirm button confirms — and keeps the old behavior only when focus is outside the dialog, which is
  the mobile case it was written for. Also: the "Got it" dismiss on the first-visit Commons notice now
  sends the `x-ctf-csrf: 1` header like every other state-changing POST in the shell (the route checks
  the Origin header rather than that one, so nothing was failing — this is consistency, so a later
  switch to the header check cannot turn it into a dismiss that never sticks); and the notifications
  panel now drops the result of a poll that lands after the member closes the panel, matching the
  canceled-flag pattern used elsewhere in the shell. Web-only; no schema, route, or contract change.
- 2026-08-09: **Removed the concierge slug-remapping layer that never ran (#2152, #2153).**
  `lib/concierge/intents.ts` carried a `SLUG_OVERRIDES` map and a `conciergeRouteSlug()` helper meant
  to translate a display slug into the registry slug that owns the route. Two things were wrong with
  it. The map's only key was `lighthouse-safety`, which is not the slug of any intent in
  `CONCIERGE_INTENTS`, so the lookup could never hit. And `lib/concierge/resolver.ts` built each
  `ConciergeMatch` from `intent.slug` directly and never called the helper, so even a valid key would
  have been ignored. Every one of the 16 intent slugs is already a real slug in the plugin registry
  (`lib/plugins/repository.ts`), so nothing needs remapping: the map and the helper are deleted rather
  than wired up, and the file header now says plainly that an intent's `slug` **is** the registry slug,
  with no translation step to catch a typo. No member-visible change — routing behaves exactly as it
  did, because the removed code never affected it. Web-only; no schema, route, or contract change.
- 2026-08-09: **Two Commons changes for a crowded phone screen (owner report, iPhone SE).** (1) The
  Contributions fundraiser gift reminder moved out of the top bar, which had no room left at 375px,
  and into the chip row: `ConciergeChipRail` (`shell-chat-panel.tsx`) now renders
  `ContributionsGiftTrigger` immediately after the 🔔 chip and before the suggestion chips, styled
  by the new `.contributeGiftBtn` class (violet accent, same pill size as the @ / 📣 / 🔔 chips,
  comic-theme variant included). It stays visible with the notifications feed open, like the three
  chips before it, and still shows only while a drive is running and the full banner is dismissed or
  snoozed. The row already scrolls sideways, so the fourth glyph costs no width. (2) The footnote
  under the composer dropped its live-state sentence ("Human-in-the-loop AI support and community
  support channel.") — it repeated the helper line directly above the message box, and two
  near-identical explanations cost a line of screen height on every phone. While the stream is live
  the footnote is now the "Community guidelines" link alone; the not-live wording ("Support channel
  keeps syncing as new messages arrive.") stays, because that one reports real connection status.
  Web-only (the Commons is web-only per rule 105); UI and copy only — no backend, schema, route, or
  contract change. Verified: `@ctf/web` typecheck, lint, and a production build.
- 2026-08-03: **Removed the `GET /api/hub/bots` stub and corrected the channel/DM descriptions.** The
  route answered every caller with a hardcoded empty list behind a `TODO`, and no caller existed — a
  documented capability the product did not have. Deleted the route and its `HubBotInfo` /
  `HubBotsResponse` types, and took it off `ctf/scripts/orphan-route-allowlist.json`. Also fixed two
  inventory lines that no longer matched the code: `GET /api/hub/dms` is described as a stub but no
  such route exists, and `GET /api/hub/channels` is described as a stub when it is the real,
  Commons-read channel list that filters the gated contributor channel by eligibility. Docs plus one
  route removal; no schema or contract change.
- 2026-08-03: **Fixed the double scroll that hid the bottom of the Commons on a phone (owner report, follow-up to the sign-in button removal below).** Removing the button was not enough: the line under the message list was still off screen, and reaching it meant scrolling the list to its end and then scrolling the page. Cause: `.shell` and `.frame` were `height: 100vh`, and on a phone `100vh` is the *large* viewport — the height the page would have with the browser's address bar hidden — so the shell was taller than the visible area and the document could scroll by that difference. Both now use `100dvh` (the dynamic viewport, which tracks the visible height), with `100vh` kept first as the fallback for browsers without `dvh`, so the document has nothing left to scroll. Added `overscroll-behavior: contain` to `.chatMessages` so finishing the message list no longer hands the rest of the gesture to the page behind it. Net effect: the shell is exactly one screen, only the message list scrolls, and whatever sits under it is always visible — the closing line when signed out, the composer when signed in. Web-only (the Commons is web-only per rule 105); CSS only, no component, backend, schema, route, or contract change. Verified: `@ctf/web` typecheck, lint, and a production build.
- 2026-08-03: **Removed the full-width "Sign In to Get Started" button from the signed-out Commons (owner request).** On a phone the gradient button sat below the last community post and pushed the closing line off the first screen, so a visitor had to scroll past the posts to see the whole page. The button is gone from `PublicCommunityPanel` (`shell-chat-panel.tsx`); the short line under the posts stays and now spans the full row (`.chatSuggestionsInfo` gets `flex: 1 1 100%` and drops the top margin that only separated it from the button). Signing in is unchanged and still offered twice — the gradient "Sign in" in the mobile top bar and the outline "Sign In" in the right rail on wide screens. The now-unused `.chatSignInLink` rules (and its comic-theme override) were deleted, and the `signInUrl` prop was dropped from `ShellChatPanel` / `ChatSection` / `ShellMainContent`, which only existed to feed that button — the top bar and right rail read `signInUrl` directly from the shell as before. Signed-out view only; the authenticated panel is untouched. Web-only (the Commons is web-only per rule 105); no backend, schema, route, or contract change. Verified: `@ctf/web` typecheck, lint, and a production build.
- 2026-07-25: **Code-review sweep fixes (hub plugin).** Four findings addressed. (1) `DELETE /api/hub/messages/:postId` and `POST /api/hub/messages/:postId/reactions` now reject a malformed (non-UUID) `postId` with 400 before touching the repository, via the newly exported `normalizeUuid` (`lib/feed/repository.ts`) — an arbitrarily long/malformed path can no longer waste a DB round-trip (#1874). (2) The Commons live layer (`lib/hub/live-stream.ts`) no longer calls `connectUser` on the shared `StreamChat.getInstance` singleton when it is already connected as a different user: it disconnects the stale user first and reuses the client when it is already this user, closing a cross-user real-time event leak on account switch/reconnect (#1872). (3) `HubChannelInfo.visibilityScope` is now a real union (`'public' | 'authenticated' | 'eligible' | \`role:${string}\``, `HubVisibilityScope`) instead of collapsing to `string` (#1875). (4) Corrected the misleading "moderators keep read access" comment in `app/api/hub/channels/route.ts` — the gated channel's disclosed moderator is an admin acting as moderator (`gate.auth.isAdmin`); there is no separate moderator role for this channel, so behavior was already correct (#1873). Two sweep findings were assessed as not applicable and closed: #1876 (the DELETE audit's `pluginId: 'feed'` is correct — `logFeedAudit` only accepts `'feed' | 'announcements'`, and the command/target are feed-domain) and #1871 (already verified: `replyToPostId` is the quoted post's own id). UI/route-guard + types only — no schema or contract change. Verified: `@ctf/web` typecheck, lint, build.
- 2026-07-23: **Suggestion chips are true one-tap asks now (#471), split by behavior.** The Commons chips previously all ran the local keyword concierge (`sendConciergeAsk`) — an instant reply pointing at a feature, but not the AI assistant and not a real navigation. They now carry an explicit behavior (new `lib/concierge/hub-suggestions.ts`, `HubSuggestionChip`): **navigate** chips ("Show housing options" → LightHouse, "Open the provider directory" → **Foundation** (the provider directory is Foundation, not the Directory plugin), "Browse the skills directory" → Directory, "Check my Service Credits" → ServiceCredits) render as links that open `/apps/<slug>` in one tap (Workforce is intentionally not a chip — it's the macro real-time work/skills-distribution dashboard and doesn't reduce to an accurate one-line action); the **ask** chip ("What is the GDP tracker showing this week?") calls a new `askComic` in `use-home-chat.ts` that prepends the `@comic` mention (the `/api/comic/message` route only routes a mentioned body — an unmentioned one is a peer post no-op), goes through the same first-use consent gate, and shows the "Reviewing for safety" pending card immediately, then the human-approved answer. So a chip tap always returns something — a navigation or an AI answer — never just a composer pre-fill. Web-only (the Commons is web-only per rule 105; Android is narrowed to Chyme). `sendConciergeAsk`/the keyword resolver stay for free-text. No schema, route, or contract change. Verified: `@ctf/web` typecheck, lint, a11y lint, and `build:ci`.
- 2026-07-22: **Fix: an in-app notification "Open" tap now actually jumps to the message.** A
  notification links to `/?post=<id>` / `/?announcement=<id>`, which is the same route the Commons
  already sits on, so tapping "Open" from the 🔔 panel did a client-side navigation that did **not**
  remount the shell — the mount-only deep-link effect never fired, the panel stayed open, and nothing
  moved. The Commons shell (`shell-chat-panel.tsx`) now intercepts the tap: it leaves the panel, forces
  the unfiltered stream (`showAllStream` in `use-home-chat.ts`), pulls the target's "load around" window
  (`loadAround`), and scrolls + flashes the message in place, blocking the Link's own navigation. A
  non-Commons link (e.g. `/apps/<plugin>`) still navigates normally. The cold-entry path (a fresh page
  load / device-push tap opening the URL directly) keeps the existing mount-effect jump. Web-only; no
  schema, route, or contract change.
- 2026-07-22: **Deep-link "load around" for notification "Open" (web / mobile-responsive).** A notification's "Open" links to a specific message (`/?post=<id>`) or announcement (`/?announcement=<id>`), but the Commons only ever loaded the recent page, so a target older than that window could not be scrolled to. `GET /api/hub/messages` now accepts `aroundPost` / `aroundAnnouncement`: `listFeedTimeline` (`lib/feed/repository.ts`) resolves the target feed item, counts how many items are newer than it under the same visibility filters (its rank in the DESC order), and offsets back half a page so the target sits mid-window. The client (`use-home-chat.ts`) reads the deep-link param once on entry and merges that centered window in alongside the recent page (the merge is additive, so both the old message and current activity are present); the Commons shell (`shell-chat-panel.tsx`) then scrolls the message (or announcement card) into view and flashes it, retrying up to ~12s while the window loads. Unfiltered stream only (ignored under `mentions=me` / `channel=announcements`); an unknown/deleted id falls back to the recent page. No schema or contract change; additive, backward-compatible route params.
- 2026-07-20: **Enter no longer sends in the Commons composers — it inserts a line break (owner request).** Members reported hitting Enter and having the message sent when they meant to start a new paragraph. Enter (with or without Shift) now always inserts a line break; sending is only via the ➤ send button. Removed the Enter-to-send `onKeyDown` handler from the three Commons composers: the main home composer (`shell-chat-panel.tsx`), the announcement reply composer (`announcement-card.tsx`), and the gated contributor-channel composer (`gated-chat-panel.tsx`). This supersedes the "Enter sends, Shift+Enter inserts a line break" behavior noted in the 2026-07-17 multi-line composer entry below. Web-only, copy/behavior-only; no backend, schema, route, or contract change. The Android composer is a separate `TextInput` and is unaffected.
- 2026-07-17: **Clickable "Open <Plugin>" chip on linked announcements (web + Android).** When an announcement links a plugin, the Commons only showed the plain `Open <Plugin>: <url>` line in the body. Now the official card also renders a tappable chip. `GET /api/hub/messages` resolves each announcement's linked plugin to `{ slug, name }` — a new batched `resolveAnnouncementLinkedPlugins(ids)` in `lib/feed/repository.ts` (reuses the existing `resolveLinkedPlugin` visible/non-admin rule) called once per page in the route — and carries it on `HubMessage.linkedPlugin` (null otherwise). Threaded through `ChatMessage`; the web card (`announcement-card.tsx`) renders an emerald `.announcementChip` linking to `/apps/<slug>`, and the Android card (`HubHome.tsx`) renders a chip that opens `https://app.chargingthefuture.com/apps/<slug>` via `Linking`. The plain URL line stays in the body (owner likes it). Additive contract field; no schema or route addition. Verified: typecheck (web + mobile + shared), lint, production build.
- 2026-07-17: **Commons composer is now multi-line (members can break lines / write paragraphs).** The composer was a single-line `<input>` (`shell-chat-panel.tsx`), so a member could not insert a line break and pasting multi-paragraph text was flattened by the browser before it was ever sent — which is why the prior server-side newline-preservation fix appeared to do nothing. Replaced it with an auto-growing `<textarea>`: **Enter sends**, **Shift+Enter inserts a line break**. The textarea grows with content up to ~160px then scrolls (`.chatInput` gets `resize:none` + `max-height` + auto-grow effect on the `input` value); the send button bottom-aligns (`.chatInputWrap` → `align-items: flex-end`). Paired with the earlier `normalizeMultilineText` + `white-space: pre-wrap` change, paragraphs now survive end to end. Web-only — the Android composer `TextInput` already has `multiline`. No backend, schema, route, or contract change.
- 2026-07-17: **Removed the community-wide "Verified Community" claim from the Commons shell (owner directive; same class of unverifiable claim already removed from Directory).** There is no community-wide verification — only per-member, admin-reviewed verification (Trust `trustStatus`). Two web copy fixes: (1) the right-rail welcome-card badge (`shell-right-rail.tsx`) no longer shows "Verified Community ✓" to every signed-in member; it now reads "Verified member ✓" (same check glyph and `profileBadge` styling) and renders only when the member's own `trust.trustStatus === 'verified'` — unverified members get no badge; (2) the left-sidebar footer line (`shell-sidebar.tsx`) drops "Verified Community" and keeps the honest remainder, "Invite Only" (the "4.9M survivors worldwide" line is untouched). Copy-only + a render gate on an already-passed prop; no backend, schema, route, or contract change. A related over-claim in the Mood crisis rail is logged in the Mood inventory.
- 2026-07-17: **"@ Mentions" chip moved inline on desktop (owner directive).** On desktop the chip floated right-aligned above the message stream and looked detached from everything around it. It now renders as the leading chip inside the concierge question-chip row on all widths — the same placement, pill size, sky-blue color, and behavior phone width already had (the phone-only condition became unconditional; the concierge row now always renders since the chip is always present). The unused desktop-row CSS (`.mentionsFilterRow`) was removed from `community-shell.module.css`. Behavior identical; web-only presentation change — Android keeps its header pill; no backend, schema, route, or contract change.
- 2026-07-16: **Fixed a spurious "Open <Plugin>" button appearing on peer posts.** The Commons rendered an "Open GDP →" (or LightHouse/ServiceCredits/Directory) action button on peer community posts whose body happened to contain a keyword like "economy"/"housing", making it look as if the author had attached a plugin link — which members cannot do and did not do. The cause was the legacy `getActionForText()` keyword inference inside `buildChatMessage` (`use-home-chat.ts`), which ran on every stored (server) message. Removed the inference entirely (it was already flagged in the build checklist as superseded). Action buttons now come only from an explicit source — the local concierge reply sets its own `actionLabel`/`actionSlug`; a peer post never carries an inferred action. Web-only (Android never had this inference); no schema, route, or contract change. The action was client-side only and never persisted, so nothing needs cleanup.
- 2026-07-16: **Signed-out Commons restyled to Discord-style message rows (owner directive).** The public (signed-out) Commons list in `shell-chat-panel.tsx` previously rendered each community post as a saturated color-tinted chat bubble (per-author hue-family gradient). The owner does not want colored blobs, so each message is now a full-width row — avatar on the left, handle + timestamp on top, body text below in the normal foreground color — with the row background carrying a faint desaturated per-author highlight (`hsla(authorHue, 30%, 50%, 0.09)`; anonymized "Community member" posts get a neutral `rgba(255, 255, 255, 0.04)`), 8px-rounded corners, and comfortable padding. Consecutive messages from different members stay visibly distinguishable by these alternating faint tints; per-author avatar colors are unchanged. `publicBubbleBackground` was replaced by `publicRowBackground`, with new `publicChatRow` / `publicChatContent` / `publicChatMeta` / `publicChatTime` / `publicChatBody` classes in `community-shell.module.css`. Signed-out view only — the authenticated panel is untouched; no backend, schema, route, or contract change.
- 2026-07-16: **Delete your own Commons post (owner decision: delete + repost instead of edit).** Members had no way to change a posted message — the Commons has no edit endpoint. Rather than add in-place editing (which opens a bait-and-switch fraud vector: edit a post others already reacted to/replied to into a scam), the product allows deleting your own post and posting again. Added `deleteCommunityPost` (`lib/feed/repository.ts`, author-only, hard delete that cascades replies + reactions and removes the projected `feed_items` row) and `DELETE /api/hub/messages/:postId` (hub gate + CSRF; 403 for a non-owner, 404 if gone). Web (`shell-chat-panel.tsx` + `use-home-chat.ts`) and Android (`HubHome.tsx` + `api.ts`) show a "Delete" affordance on the member's own peer bubbles with a confirm. New command `feed.community.post.delete` + access policy + audit event; deletion contract documents the self-delete surface. No schema change (existing cascades cover cleanup). Verified: typecheck (web + mobile + shared), lint, and a production build.
- 2026-07-16: **"@ Mentions" filter in the Commons (web + Android).** Members get @-mentioned in the Commons (plain text like `@farah` or `@user-3gysu61f`) with no notification system, so mentions were easy to miss while scrolling. A small "@ Mentions" toggle now filters the stream to messages that mention the signed-in viewer. Server-side: `GET /api/hub/messages` accepts an optional `mentions=me` query param; the route derives the caller's two handle forms server-side from the authenticated user (`@<username>` when set, plus the stable `@user-<first 8 of the id minus the user_ prefix>` pseudonym via the new `feedMentionTokens` in `lib/feed/author-handle.ts`) — a client-supplied handle is never accepted — and `listFeedTimeline` (`lib/feed/repository.ts`) gained an optional `mentionHandles` filter applied as parameterized, LIKE-escaped (`\`, `%`, `_`) `ILIKE ANY` patterns on `feed_items.body`, so old mentions beyond the loaded page are found and the existing pagination limit is kept. Mentions mode reads only the `community` channel (announcements and AI Q&A cards are hidden). Web: toggle chip in `shell-chat-panel.tsx` — it renders inline as the leading chip of the concierge question-chip row at every width (desktop and phone width alike; updated 2026-07-17, see below), sized like those pills but sky-blue with the @ icon so it stays distinct (owner directive, 2026-07-16; styled like the @comic mention chip, comic-theme override included) — mode handling in `use-home-chat.ts` (clears + re-fetches on flip; drops responses that raced a flip). Android: header pill in `HubHome.tsx` (reaction-pill family) with `fetchHubMessages(mentionsOnly)` in `api.ts` — the Android Commons has no concierge chip row, so the pill stays in the header. Empty state on both: "No mentions yet. When someone writes @<handle>, it shows here." Contract: `feed.timeline.fetch` bumped to 2.1.0 with the optional `mentions` input (`FEED_PLUGIN_COMMAND_CONTRACTS.yaml`). No schema change; additive, backward-compatible route param.
- 2026-07-16: **Retired the announcement "Urgent" badge and the `mandatory` field (owner decision).** The "Urgent" badge (amber, driven by `mandatory`) landed a harsh, non-trauma-informed label on ordinary posts like a welcome announcement, and `mandatory` no longer does anything now that every announcement flows through the Commons (there is no dismiss guard). Removed the badge from the web official card (`announcement-card.tsx`) and the Android card (`HubHome.tsx`), and dropped `mandatory` from the `HubMessage` contract, `ChatMessage`, and the mobile `HubMessage` type. The official card keeps its "Official" shield badge and the title heading. See the feed inventory change log (2026-07-16) for the full schema/contract retire of `priority` + `mandatory`. Verified with typecheck, lint, and a production build.
- 2026-07-16: **Official announcement card in the Commons (web + Android).** Announcements rendered as an ordinary purple hub bubble, indistinguishable from AI answers and system lines. They now render as a distinct card (`components/community-shell/announcement-card.tsx`): emerald treatment with a left accent, an "Official" shield badge, an "Urgent" amber badge for mandatory announcements, the announcement title as a heading, then the body. To drive it, `GET /api/hub/messages` now carries three additional display-only fields on `HubMessage` — `kind` (`announcement` | `question` | `community`), `title` (the announcement heading, split out of the body server-side so the card can render it separately), and `mandatory` — threaded through `ChatMessage` and rendered by `shell-chat-panel.tsx`. The Android Hub (`HubHome.tsx` + `api.ts`) carries the same fields and renders the title heading plus the "Urgent" badge (it already showed an "Official" badge on official posts); this also prevents mobile from dropping the title now that the body no longer contains it. Additive contract change (new fields; existing consumers unaffected); no schema or route addition, no change to the signed-out public Commons (still community posts only). Verified with typecheck, lint, and a production build.
- 2026-07-14: **Android pull-to-refresh on the Commons (`HubHome.tsx`).** Dragging the message list down re-pulls the Hub messages in the background (the existing `load` never re-enters the full-screen spinner after first mount, so the chat stays visible while it re-pulls). Complements the poll and the live Stream layer as a manual refresh gesture. Mobile-client only — no backend, schema, route, or contract change.
- 2026-06-23: **Android parity — Commons live Stream layer + typing indicator (#730).** The React
  Native Hub home (`ctf/packages/mobile/src/features/hub/HubHome.tsx` + a new `live-stream.ts`) now
  matches the web Commons live layer. On entry it calls `POST /api/hub/join` through `authedFetch`
  (`fetchHubJoin`) for real Stream credentials and, when Stream is configured, opens one `stream-chat`
  connection to the shared `ctf-feed-community` channel (the same `StreamChat.getInstance(apiKey)` +
  `connectUser({ id: streamUserId }, streamToken)` + `channel('messaging', streamChannelId).watch()`
  pattern the Direct Line / TrustTransport mobile tabs use). A `message.new` (and
  `connection.recovered`) event triggers the existing `load()` so new posts appear immediately, and
  the 15s poll slows to a 30s backstop while the live connection is healthy. Typing: composer
  keystrokes call `channel.keystroke()`; incoming `typing.start`/`typing.stop` surface a subtle
  "X is typing…" line above the composer (collapsing to "X and Y are typing…" / "N people are
  typing…"), cleared on send and absent in polling-only mode. Polling fallback preserved: when
  `POST /api/hub/join` returns `configured: false`, or the join call / connect / watch fails,
  `fetchHubJoin`/`connectHubLive` resolve to null and the screen silently stays on the 15s poll —
  the live layer is purely additive and a Stream failure never breaks or blanks the Hub. The
  connection disconnects on unmount. Matches the web's deferred set: no online-presence dots, read
  receipts, or delivery status. No schema, route, or contract change — binds the existing
  `/api/hub/join` route. This opens a live Stream connection per mobile Hub viewer; see the quota note
  `ctf/docs/quota-impact/2026-06-23-mobile-commons-live-stream.md`. Mobile typecheck + lint clean.
- 2026-06-23: **Android parity — Direct Line chat mentions + search + link previews (#734).** Brings the mobile shared chat `components/shared/StreamChatView.tsx` (used by chyme's `StreamChatPanel` and the Direct Line tabs: TrustTransport, SocketRelay, LightHouse, Foundation) to parity with the web chat's three additions, built on top of the #699 threads/reactions layout (the `OverlayProvider` + `thread`/`threadList` `<Channel>` + `<Thread/>` + accent/gray `myMessageTheme` are all preserved unchanged). (1) **@mention autocomplete** — a default in stream-chat-react-native 8.13.x: the `MessageInput`'s built-in `@` trigger reads the watched channel's members and renders the suggestion popup inside the existing `OverlayProvider`; `channel.watch()` is changed to `channel.watch({ presence: true })` so the member list is loaded for the suggestions (matching the web panel). No new prop needed to enable it. (2) **In-channel message search** — stream-chat-react-native ships no drop-in search UI like the web SDK, so a new small sibling component `components/shared/StreamChatSearch.tsx` (rule-116: one component per file) provides it: a collapsed "Search" affordance expands into a text field that runs `channel.search(term, { limit: 25, sort: { created_at: -1 } })` scoped to the current channel and lists the matches (author + timestamp + text, two lines) in a `FlatList`, handling the empty / loading / no-results / error states; it sits above the `MessageList` in the non-thread view and is collapsed (zero search calls) by default. (3) **Link previews** — automatic: Stream enriches posted URLs server-side into `og_scrape` attachments, which the default `MessageList` Attachment renderer draws as preview Cards, so no enabling was needed. Loading / error / "Chat unavailable" states and the public prop contract are unchanged (additive only). Mentions and link previews are zero net new Stream calls; search adds a small, user-initiated volume of `channel.search` calls (`ctf/docs/quota-impact/2026-06-23-mobile-chat-mentions-search-previews.md`). Mobile lint clean (0 warnings); `tsc` reports only a pre-existing tsconfig `baseUrl`/`ignoreDeprecations` deprecation unrelated to this change.
- 2026-06-23: **Android parity — richer Direct Line chat (threads + reactions) (#699).** Brings the mobile shared chat `components/shared/StreamChatView.tsx` (used by chyme's `StreamChatPanel` and the Direct Line tabs: TrustTransport, SocketRelay, LightHouse, Foundation) up to the web's richer Stream layout. The bare `<Chat><Channel><MessageList/><MessageInput/></Channel></Chat>` is now wrapped in `OverlayProvider` (required for the long-press reaction picker, message-action menu, and thread navigation to render above the chat). Threaded replies: a `thread` state tracks the selected parent message; `thread` + `threadList` are passed to `<Channel>`; when a thread is open it renders a "‹ Back" affordance plus `<Thread />`, otherwise `<MessageList onThreadSelect={setThread} />` + `<MessageInput />`. Reactions, the typing indicator, and read state are the SDK's defaults once the channel (type `messaging`) is wrapped by `OverlayProvider` — no extra prop needed to turn reactions on. The accent/gray bubble theming from #702 is preserved exactly: the "others take the plugin accent" theme now travels through the `OverlayProvider value={{ style }}` global theme (replacing the previous `ThemeProvider style={...}` wrapper) so the reaction overlay and thread view inherit the same bubbles, while the member's own messages stay gray via the unchanged Channel-level `myMessageTheme`. Loading / error / "Chat unavailable" states are unchanged; the public prop contract is unchanged. Presentation/SDK-layout only — no new Stream API calls and no quota impact (`ctf/docs/quota-impact/2026-06-23-mobile-stream-chat-threads-reactions.md`). Mobile typecheck + lint clean.
- 2026-06-23: **Android parity — chat bubble color convention (#702).** Styling only, mirroring the web: the logged-in member's own messages are gray; everyone else's use the plugin color. (1) Mobile hub chat (`HubHome.tsx`): a community (peer) post from the current member (`message.userId === useAuth().user.id`) renders a neutral gray bubble; everyone else's community post takes the hub/community accent tint; official announcement/AI cards keep the Hub brand treatment. (2) Direct Line chat (`components/shared/StreamChatView.tsx`, used by chyme): a new optional `accentColor` prop themes the GetStream message list so other people's bubbles take the plugin accent (base `ThemeProvider` theme) while the member's own stay gray (`myMessageTheme`). No API/schema/contract change and no new Stream calls — purely presentation, so no quota impact.
- 2026-06-23: **Android parity — Commons reply-to-message + unread divider (#693).** The React Native hub home (`packages/mobile/src/features/hub/HubHome.tsx` + `api.ts`) now matches the web Commons. (1) Signal-style reply: each peer bubble has a "Reply" affordance that sets a "Replying to …" composer banner (author + snippet + cancel ×); sending passes `replyToPostId` (the target's `communityPostId`) to `sendHubMessage`, and a message with a resolved `quotedMessage` (`{ author, snippet }`, new on the mobile `HubMessage`) renders a quoted block above its body. (2) Unread divider: new `fetchHubLastSeen()` / `markHubSeen()` clients over `GET`/`POST /api/hub/last-seen`; on entry the screen reads the marker, draws a single "New messages" divider before the first message newer than it (computed once so it does not jump as posts arrive), then moves the marker forward — all best-effort so a failure never breaks the chat. No schema, route, or contract change — binds the existing reply/last-seen routes.
- 2026-06-23: **Android parity — emoji reactions on Commons community posts (#704).** The React Native hub home (`packages/mobile/src/features/hub/HubHome.tsx` + `api.ts`) now renders the same reaction row under each peer bubble as the web Commons. The mobile `HubMessage` gained `communityPostId` and `reactions` (`{ emoji, count, reactedByMe }[]`, already returned by `GET /api/hub/messages`); a peer post (`communityPostId != null`) shows each reacted emoji as a pill (emoji + count, highlighted when the member reacted) plus an "add reaction" affordance that reveals the fixed quick set `HUB_REACTION_EMOJIS` (👍 ❤️ 😂 🎉 🙏 😢). Tapping a pill or picker emoji calls the new `toggleHubReaction(postId, emoji)` (`POST /api/hub/messages/:postId/reactions`, `{ emoji }` → `{ ok, reacted }`), flips the reaction optimistically, and reconciles via the existing 15s poll; a failure reloads to the server truth. Reactions show read-only for signed-out viewers (toggling requires sign-in). No schema, route, or contract change — binds the existing table/route.
- 2026-06-21: Commons live Stream layer + typing indicator (web + mobile-responsive; Android deferred) — task 1 of `STREAM_FEATURE_ADOPTION.md`, the real-time foundation kept beneath the custom Commons design. `POST /api/hub/join` no longer returns hardcoded stub credentials; it mints real Stream credentials for the shared `ctf-feed-community` channel via `getFeedStreamCredentials(userId, displayName, 'community')`, returning `{ ok: true, configured: true, … }` or `{ ok: true, configured: false }` when Stream is not set up. The Commons hook (`use-home-chat.ts`) opens a `stream-chat` connection to that channel when credentials are minted and subscribes to events: a `message.new` (and `connection.recovered`) event triggers the existing `refreshHistory()` so new posts appear immediately, and the 10s poll slows to a 30s backstop while the live connection is healthy. The connection disconnects on unmount, and any failure (Stream unconfigured or a failed connect/watch) silently falls back to the 10s poll — Commons never breaks. Typing: keystrokes emit `channel.keystroke()`; incoming `typing.start`/`typing.stop` surface a subtle "X is typing…" line above the composer (`shell-chat-panel.tsx`), on-brand with the dark palette, cleared on send and absent in polling-only mode. Read receipts (#18), delivery status (#19), and presence dots (#20) are deferred follow-ups (see Gaps #5). New client helper `lib/hub/live-stream.ts` isolates the connection/typing/disconnect logic. Files: `lib/hub/types.ts`, `lib/hub/live-stream.ts`, `app/api/hub/join/route.ts`, `components/community-shell/{use-home-chat.ts,shell-chat-panel.tsx,community-shell.module.css}`. No schema or contract change. Typecheck + lint clean; build passes with Stream env vars absent (degrades to polling).
- 2026-06-21: Emoji reactions on Commons community posts (web + mobile-responsive; Android deferred) — the first feature of the Stream-adoption initiative, using "approach b" (reactions stored in our own Postgres; Stream is not involved). Under each peer bubble a compact reaction row shows any reacted emoji as a pill (emoji + count, highlighted when the member reacted) plus an "add reaction" picker over a fixed quick set (👍 ❤️ 😂 🎉 🙏 😢, exported as `FEED_REACTION_EMOJIS`). Tapping a pill or picker emoji toggles the reaction optimistically and reconciles via the existing 10s poll. New table `feed_community_post_reactions (id PK, post_id → feed_community_posts ON DELETE CASCADE, user_id, emoji, created_at)` with a unique index on `(post_id, user_id, emoji)` (toggle) and a `post_id` index (aggregate read). `toggleCommunityPostReaction` validates the emoji and post then `INSERT ... ON CONFLICT DO NOTHING` / `DELETE` to toggle. `listFeedTimeline` aggregates reactions in one batched query and attaches `FeedCommunityDetail.reactions` (`FeedReactionSummary`), carried through to `HubMessage.reactions` and `ChatMessage.reactions`. New route `POST /api/hub/messages/:postId/reactions` (hub gate + CSRF; 400 for an out-of-set emoji or unknown post). Files: `schema.sql`, `lib/feed/constants.ts`, `lib/feed/types.ts`, `lib/feed/repository.ts`, `lib/shared/feed-primitives/types.ts`, `lib/hub/types.ts`, `app/api/hub/messages/route.ts`, `app/api/hub/messages/[postId]/reactions/route.ts`, `components/community-shell/{shell-types.ts,use-home-chat.ts,shell-chat-panel.tsx,community-shell.module.css}`, plus the three FEED contract files. `schema.demo.sql` regenerated; drift gate passes; typecheck + lint clean.
- 2026-06-21: Added two Commons (Survivor Hub home) chat features (web + mobile-responsive; Android deferred via Parity Ticket). (1) Signal-style quoted reply: a per-peer-message "Reply" affordance sets a "Replying to …" composer banner (quote preview + cancel X); sending posts the message with `replyToPostId` and renders a compact quoted block (author + ~120-char snippet) above its body. Backed by the new nullable self-reference `feed_community_posts.reply_to_post_id` (`ON DELETE SET NULL`); the quote is resolved server-side and carried as `HubMessage.quotedMessage` plus a new `communityPostId` (the reply target id). `POST /api/hub/messages` and `POST /api/feed/community/posts` accept `replyToPostId`. (2) Unread divider: new table `feed_hub_last_seen` and `GET`/`POST /api/hub/last-seen` (member endpoint; CSRF on POST; marker clamped to NOW() and never moved backwards). The chat reads the marker on entry, draws a single "New messages" divider before the first entry newer than it (placed by the per-entry `epoch`), and marks seen once after viewing — all best-effort so a failure never breaks the chat. Files: `schema.sql`, `lib/feed/repository.ts`, `lib/feed/types.ts`, `lib/hub/types.ts`, `app/api/hub/messages/route.ts`, `app/api/hub/last-seen/route.ts`, `app/api/feed/community/posts/route.ts`, `components/community-shell/{shell-types.ts,use-home-chat.ts,shell-chat-panel.tsx,community-shell.module.css}`. `schema.demo.sql` regenerated; drift gate passes; typecheck clean.
- 2026-06-18: Right-rail cleanup. Reframed the "About Survivor Hub" copy to be chat-first ("say what you need in the chat… we'll point you to the right place") instead of the off-brand "connects you with N live plugins… in one place" framing. Removed the "Ready Apps" list and the "· N ready apps" line from the signed-in profile card ("ready apps" read as meaningless); apps are reached via the Apps section. Dropped the now-unused `readyApps`/`implementedCount` props from `ShellRightRail` and their computation in `community-shell.tsx`. Presentation only — no API/route/schema change.
- 2026-06-18: Fixed home-chat ordering and added auto-scroll. Concierge messages (`sendConciergeAsk`) were created without `sentAtIso`, and the stream's `toEpoch` falls back to the array index when a timestamp is missing — so a tapped chip's question/reply got a tiny epoch and sorted to the **top** of the chat instead of the bottom. They now carry a real `sentAtIso` and sort newest-last. Also added a bottom sentinel + `scrollIntoView` so the chat auto-scrolls to the latest entry when the stream grows (`shell-chat-panel.tsx`). Note: the home/Survivor Hub chat is the custom Feed-backed stream, not GetStream (Stream is only the LightHouse/Chyme DM surfaces); these are fixes to that custom stream, not a Stream migration. No API/route/schema change.
- 2026-06-18: Hide the "From Survivor to Thriver" hero banner + stats on mobile in the signed-in home chat (`shell-chat-panel.tsx`, gated on `useIsMobile()`). On a phone it consumed most of the first screen before any chat was visible; desktop is unchanged. Presentation only — no API/route/schema change.
- 2026-06-18: Made the concierge "ask what you need" chips persistent. They previously rendered only on an empty chat (and an older chip row above the composer was commented out — #471, "only fills the composer, no answer"). That concern no longer applies: the concierge returns an instant local reply via `sendConciergeAsk` (posts the question and a feature-pointing reply). The chips are now shown above the composer at all times in `shell-chat-panel.tsx`. No API/route/schema change; feature item 6 above updated to match. (Inventory note backfilled after the code shipped in PR #593.)
- 2026-06-12: The Android Hub API client (`packages/mobile/src/features/hub/api.ts`) now uses the shared authenticated fetch helper — both the message read and the post call carry the signed-in member's Clerk bearer token and the server address comes from runtime config (APP_URL) — replacing plain dev-only fetch against hardcoded development URLs.
- 2026-06-09: Hub general channel is now the support surface for not-yet-verified members. As part of making Unlock the single source of truth for full access, `requireHubAccess` (`/api/hub/_lib.ts`) moved from "approved-user-or-admin" to the new `support_only` access tier, so `locked_support_only` members can read and post in the general channel in addition to fully-approved members. The home page renders the normal Hub for these members — nothing is hidden; tapping a plugin they cannot use yet shows that plugin's public landing page (the same view signed-out visitors get), not a denial wall. Copy that previously pointed degraded users at Chyme now points them here. No schema or contract change.
- 2026-06-01: Android parity delivered for the feed-backed Survivor Hub home channel. Added `ctf/packages/mobile/src/features/hub/` (`api.ts` reads `GET /api/hub/messages` and posts to `POST /api/hub/messages` with `x-ctf-csrf: 1`; `HubHome.tsx` renders the blended stream — official announcements/AI Q&A vs community posts — and a composer that creates a peer-to-peer community post). Wired `HubHome` as the default surface in the mobile app shell (`App.tsx`). Reconciled the `feed-announcements` parity contract `mobileFeatureDirs` to include `hub`. Removed the dead GetStream-based survivor-hub-chat mobile fixtures (`MockSurvivorHubChat.tsx`, `SurvivorHubChat.tsx`, `fetchSurvivorHubChatStreamCredentials.ts`, `index.ts`) — GetStream was removed from the platform. Public unauthenticated read left as a separate follow-up (Gaps #1). Parity: web+android complete.
- 2026-05-31: Survivor Hub ⟵ Feed consolidation implemented. `GET/POST /api/hub/messages` repointed at the Feed model (`listFeedTimeline` / `createFeedCommunityPost`, CSRF-guarded); added `feed_render_config.is_public` (default TRUE) and read it into `FeedConfig`; retired `feed-announcements` as a navigable app tile (`isVisible: false`); removed the phantom `feed_user_extension` from the seed; dropped the `hub_channels`/`hub_messages`/`hub_bot_routes`/`hub_dm_threads`/`hub_bots` plan and reconciled this inventory + the Feed deletion contract to real tables. Channels/DMs/bots deferred to a single blended channel.
- 2026-05-12: Inventory rewritten as a clean snapshot per the updated rule 120. (Superseded by the 2026-05-31 consolidation: the Hub no longer owns `hub_*` schema or a dedicated GetStream scope.)
- 2026-03-23: Initial inventory created under prior phase-based template.


## Build Checklist


### Scope

- Rewrite target: `ctf/packages/web`, `ctf/packages/mobile`, `ctf/schema.sql`, `ctf/docs/contracts`.
- Surface: Survivor Hub home experience (`community-shell` + supporting APIs and schema).
- Canonical spec: `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-survivor-hub-chat-feature-inventory.md`.
- Hub has no cross-plugin runtime dependency. See [112-platform-architecture-rules.mdc](../../../../.claude/rules/112-platform-architecture-rules.mdc).
- 100% web↔Android parity is the baseline. See [105-web-android-feature-parity-rules.mdc](../../../../.claude/rules/105-web-android-feature-parity-rules.mdc). No phased rollouts.

This checklist tracks the work needed to bring code into alignment with the inventory. The inventory is the spec; this section lists the remaining work.

---

### Remaining Work

The Survivor Hub ⟵ Feed consolidation (2026-05-31) superseded the prior `hub_*` task list
(Hub-owned schema, GetStream scope, `@comic` bot, multi-channel sidebar, DMs, `seedHub.mjs`, and
`HUB_*` contracts are all dropped — the Hub reuses the Feed backend). Remaining work:

#### Done in the consolidation

- [x] Repoint `GET /api/hub/messages` at `listFeedTimeline` (blended `feed_items` read).
- [x] Repoint `POST /api/hub/messages` at `createFeedCommunityPost` (CSRF-guarded peer post).
- [x] Add `feed_render_config.is_public` (default TRUE) and read it into `FeedConfig`.
- [x] Retire `feed-announcements` as a navigable app tile (`isVisible: false`); aliases still resolve.
- [x] Remove the phantom `feed_user_extension` seed `INSERT`; reconcile the Feed deletion contract + data model to real tables.
- [x] Reconcile this inventory to the feed-backed, single-channel architecture.

#### Public read (follow-up)

- [ ] Add a public (unauthenticated) read path for the blended channel honoring `feed_render_config.is_public`, with an explicit policy for which item types are exposed publicly (security-sensitive; community posts + announcements only, no location-context question detail).

#### Mobile Hub parity (delivered 2026-06-01)

- [x] Wire the mobile home to the same feed-backed channel (reads `GET /api/hub/messages`; sends a
      community post via `POST /api/hub/messages` with `x-ctf-csrf: 1`). See
      `ctf/packages/mobile/src/features/hub/`.
- [x] Reconcile the parity contract. Added `hub` to the existing `feed-announcements` entry's
      `mobileFeatureDirs` rather than a standalone `hub` contract entry — the parity gate requires
      each contract slug to exist in the plugin registry, and the Hub is the home route (`/`), not a
      navigable app tile with its own registry slug.
- [x] Remove the dead GetStream-based survivor-hub mobile fixtures (GetStream was removed from the
      platform).

#### Cleanup (follow-up)

- [x] Remove the hardcoded `getActionForText` routing in `use-home-chat.ts` (superseded by Feed AI Q&A). Done 2026-07-16.
- [ ] Remove or formalize the `GET /api/hub/channels|dms|bots` stubs once multi-channel direction is decided.

---

### Pre-Merge Gates

- [ ] `GET /api/hub/messages` returns the blended Feed timeline; `POST` creates a community post (CSRF-guarded).
- [ ] Visual QA against the canonical Survivor Hub mockups in `design/` once the wireframes are reconciled to the single blended channel.
- [ ] GDP stats display zero/absent (not hardcoded) when no published GDP data exists.
- [ ] Right rail shows provider-backed first name or username, never hardcoded text, for signed-in users.
- [ ] No TypeScript errors in the `community-shell` component tree.
- [ ] ESLint passes with zero warnings (`pnpm lint`).
- [ ] Plugin card "Open plugin →" links navigate to correct `/apps/[slug]` routes.
- [ ] Inventory updated to reflect the merged code state (Change Log entry added).

---

### Change Log

- 2026-07-20: Commons now feeds the notifications center. `createFeedCommunityPost` notifies the
  parent post's author when someone replies to their post, and `replyToAnnouncement` notifies the
  announcement's author when someone replies — both best-effort (`notifySafe`, after commit), never on
  a self-reply, with a neutral summary and no content. These land in the member's 🔔 notifications
  feed (see the Notifications inventory). `@mention` notifications are deferred pending a
  username→user-id lookup.
- 2026-07-18: An announcement can now link **up to 3 plugins** (owner directive: more than 3 is information overload). `GET /api/hub/messages` resolves each announcement's linked plugins to an ordered `{ slug, name }[]` (batched `resolveAnnouncementLinkedPlugins(ids)`), carried on `HubMessage.linkedPlugins` (replaces the singular `linkedPlugin`; empty otherwise). The web official card (`announcement-card.tsx`) renders one "Open <Plugin>" chip per entry in a wrapping row; the body still carries one plain `Open <Plugin>: <url>` line per link. Threaded through `ChatMessage.linkedPlugins`. The native Android Hub (`features/hub/*`) was removed upstream (Chyme is now the mobile home surface), so this is a web / mobile-responsive change only. Storage/authoring changes are recorded in the Announcements inventory.
- 2026-07-18: Made the mentions filter chip icon-only ("@" glyph, dropping the "Mentions" word) on web and Android so it matches the 📣 announcements chip — the two stream filters read as a matched pair of small glyph pills. Behavior unchanged.
- 2026-07-18: Added an announcements filter chip (📣) next to the "@ Mentions" chip in the Commons stream, on web (`shell-chat-panel.tsx`) and Android (`HubHome.tsx`). "Announcements" is too long for a chip, so it shows the megaphone emoji alone. When on, the stream reads `GET /api/hub/messages?channel=announcements`, which returns only official announcements — including ones that scrolled off the recent page — so a member with limited message history can still surface them. The two filters are mutually exclusive; turning one on clears the other, and the AI (`@comic`) cards are hidden while any filter is active.
- 2026-07-18: Made the mentions filter chip icon-only ("@" glyph, dropping the "Mentions" word) on web and Android so it matches the 📣 announcements chip — the two stream filters now read as a matched pair of small glyph pills. Behavior unchanged.
- 2026-06-02: Hub peer posts now lead with the author's `@username` for signed-in members instead of the pseudonymous "Community member" label (official announcements/AI answers still show "Survivor Hub"). The Hub messages route is gated to signed-in members, so this only changes what authenticated members see; a future public Hub view would still show "Community member". Implemented Chyme-style: the poster's username is captured from their session and stored on `feed_community_posts.author_username` at post time, then surfaced through the Feed timeline. Forward-only — community posts created before this shipped have no stored username and keep showing "Community member".
- 2026-05-12: Checklist re-scoped as a task list against the canonical inventory; rules 105, 107, 112, 120 referenced; pre-merge gates assert no cross-plugin imports/fetches; phased-rollout sections removed.
- 2026-03-23: Initial checklist created under prior phase-based template.
