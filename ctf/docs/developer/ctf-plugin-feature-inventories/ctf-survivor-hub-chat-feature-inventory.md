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
  (hero stats) and the plugin registry (Apps grid). See [112-platform-architecture-rules.mdc](../../../../.github/instructions/112-platform-architecture-rules.mdc).

## Intent and Outcome

The Survivor Hub is the primary entry point of CTF for both unauthenticated visitors and authenticated survivors. It provides the home shell, one blended publicly-viewable `community` channel (interleaving admin-only announcements, AI Q&A, and peer-to-peer community posts), the live hero stats, and the plugin grid. Hub is the canonical "home" route at `/`; opening a plugin moves the user into that plugin's own scope. This is deliberately not social media: peer-to-peer posting is the only user-authored surface, kept economy-scoped. Separate channels, direct messages, and system bots are deferred (see Gaps) — the MVP is one channel.

## Target User Features

### Hub Shell

1. Four-column layout on `/apps`: icon rail (72px), left sidebar (240px), main content (flex), right rail (280px).
2. Section toggle between **Chat** and **Apps** controlled by icon rail buttons; section state is shell-local.
3. Right rail renders auth-provider username/display name for signed-in users and a sign-in CTA for unsigned visitors.
4. Right rail "About Survivor Hub" section with chat-first copy that points members to ask in the chat (no plugin-count framing).
5. Right rail no longer shows a "Ready/Active Apps" list (removed 2026-06-18) — apps are reached via the Apps section; the "· N ready apps" line was also dropped from the signed-in profile card.
6. Sign-in and Create-Account CTAs visible in icon rail and right rail for unsigned visitors.
7. Hero banner ("Free to join · End-to-end encrypted") visible to unsigned visitors.

### Hub Chat (the blended `community` channel)

1. Hero banner with live stats from the platform-owned GDP snapshot table: member count, GDP value (USD), opportunity value (target GDP minus current GDP).
2. Hero banner copy adapts: "Welcome to Survivor Hub" for unsigned visitors; "Good morning, {displayName} — your network is active." for signed-in users.
3. One blended stream interleaving admin-only announcements, AI Q&A answers, and peer-to-peer community posts. History loaded via `GET /api/hub/messages` (backed by `listFeedTimeline` over `feed_items`), polled while the shell is mounted.
4. Sending from the input creates a peer-to-peer community post via `POST /api/hub/messages` (backed by `createFeedCommunityPost`, CSRF-guarded); dedup on display by `(from, sender, text, time)` tuple.
5. AI Q&A uses the Feed inference pipeline (`lib/feed/inference.ts`, consent-gated); the hardcoded `getActionForText()` routing is superseded and removed over time.
6. Concierge "ask what you need" chips render persistently above the composer (whether or not the chat already has messages). Tapping one runs the local keyword concierge (`lib/concierge`) via `sendConciergeAsk`: it posts the member's question and an instant reply pointing at the best-matching feature (with an "Open X" action), falling back to a gentle "@comic or share with the community" message when nothing matches. They no longer merely pre-fill the input.
7. Announcements render as official Survivor Hub items; community posts render with their author.
8. Connection state visible as footer status (connecting, live, fallback).
9. Unsigned visitors see a sign-in gate in place of the input; the channel itself is publicly readable when `feed_render_config.is_public` is TRUE (public read enforcement is a tracked follow-up).

### Sidebar — Channels (deferred)

- The MVP is a single blended `community` channel; there is no `hub_channels` table and no multi-channel sidebar. Splitting into multiple Hub channels is a possible future option pending feedback (see Gaps). Stubbed `GET /api/hub/channels` returns a single `community` channel.

### Sidebar — Direct Messages (deferred)

- Direct messages are out of scope for the consolidated MVP — peer-to-peer interaction happens only in the public blended channel (intentional, for soft moderation and marketing visibility). `GET /api/hub/dms` is a stub returning an empty list; there is no `hub_dm_threads` table.

### Sidebar — Bots (deferred)

- There is no `hub_bots` / `hub_bot_routes` system-bot entity in the MVP. The assistant capability is the Feed AI Q&A — now built as the `comic` subsystem (`@comic` mention; user-facing label "AI Assistant"), specified in `ctf-comic-feature-inventory.md` (the source of truth for the AI assistant). `GET /api/hub/bots` is a stub returning an empty list.

### Hub Apps (Apps Section)

1. Three-column plugin grid driven by the platform-owned plugin registry (`GET /api/plugins`).
2. Per-plugin color theme and emoji from `shell-plugin-config.ts`.
3. Sort modes: **recent**, **alphabetical**, **most-used**. Selection persists in `localStorage` (`ctf.communityShell.pluginSortMode`).
4. Recent-use tracking persists in `localStorage` (`ctf.communityShell.recentPluginSlugs`); capped at 12 entries.
5. Most-used tracking persists in `localStorage` (`ctf.communityShell.pluginUsageCounts`).
6. Sidebar in apps mode shows a flat searchable plugin list; selection sets the active app and updates recent/used counters.
7. Search filters by name and summary.
8. Cards link to `/apps/[slug]` for each plugin.

## Target Admin Features

1. Announcement authoring (admin-only) and channel config (enabled channels, `is_public`) are operated through the Feed admin surface at `/admin/feed-announcements` and the `feed.*` command namespace — the Hub has no separate admin contract surface.
2. There is no bot or channel-visibility admin surface in the MVP (deferred with channels/DMs/bots).

## API Surface and Route Map

The Hub home channel is backed by the Feed model. Hub routes under `/api/hub/*`:

- `GET /api/hub/messages` — blended channel history, backed by `listFeedTimeline` over `feed_items` (announcements + AI Q&A + community), mapped to the `HubMessage` contract. Returns `channelId: 'community'`.
- `POST /api/hub/messages` — create a peer-to-peer community post, backed by `createFeedCommunityPost` (CSRF-guarded; rate-limit + moderation honored).
- `GET /api/hub/channels` — stub returning the single `community` channel (multi-channel deferred).
- `GET /api/hub/dms` — stub returning an empty list (DMs deferred).
- `GET /api/hub/bots` — stub returning an empty list (bots deferred).
- `POST /api/hub/join` — presence/credentials handoff for the home shell.

Feed routes that own the data layer remain under `/api/feed/*` (timeline, announcements lifecycle, questions/answers, community posts/replies) and `/admin/feed-announcements`.

Web entry routes:

- `GET /` — Survivor Hub home page (Next.js `app/page.tsx`, `CommunityShell` chat section).
- `GET /apps` — Hub home, Apps section (`app/apps/page.tsx`).

## Data Model and Storage Contracts

The Hub owns no message/channel/bot tables. Its channel is backed by the Feed schema (canonical in `ctf/schema.sql`):

- `feed_items` — the blended timeline projection (`item_type` ∈ announcement | question | community).
- `feed_community_posts` / `feed_community_replies` — peer-to-peer posts.
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
- Android: delivered. The mobile home (`ctf/packages/mobile/src/features/hub/`) reads the blended
  channel from `GET /api/hub/messages` (the same feed-backed timeline the web Hub uses, flattened to
  the `HubMessage` shape) and sends a peer-to-peer community post via `POST /api/hub/messages` with
  the `x-ctf-csrf: 1` header, mirroring the web CSRF handling. `HubHome` is the default surface in
  the mobile app shell. Announcements render with the official Survivor Hub treatment; community
  posts render with their author. The dead GetStream-based survivor-hub-chat mobile fixtures were
  removed. The single AI Assistant (`@comic`) surfaces — answer cards, the "Reviewing for safety"
  pending card, the `@comic` composer, consent, and ratings — are delivered separately in the comic
  Android parity work (see `ctf-comic-feature-inventory.md`).
- Public unauthenticated read of the blended channel is **not** part of this Android pass: like web,
  `GET /api/hub/messages` still requires a signed-in session. As of 2026-06-09 the Hub routes use the
  `support_only` access tier, so both fully-approved members and not-yet-verified `locked_support_only`
  members may read and post here — the general channel is the support surface for members still in the
  Unlock flow. The public unauthenticated read path is a separate, security-sensitive follow-up (see
  Gaps #1).

Parity Status: web+android complete.

## Seed Coverage Status

There is no `seedHub.mjs`; the Hub channel's data layer is seeded by the Feed seed `ctf/scripts/seedFeedAnnouncements.mjs` (announcements, feed items, render config including `is_public`, community/question fixtures). The dropped `hub_*` tables are not seeded.

## Gaps and Known Technical Debt

1. Public unauthenticated read of the blended channel: `feed_render_config.is_public` is set and read into config, but `GET /api/hub/messages` / `listFeedTimeline` still require an authenticated session. A public read path (and the policy for which item types are exposed publicly) is the tracked follow-up.
2. Mobile Hub parity: delivered. The mobile home reads/writes the feed-backed channel via `GET/POST /api/hub/messages` (`ctf/packages/mobile/src/features/hub/`). The parity contract reconciliation was done on the existing `feed-announcements` entry (its `mobileFeatureDirs` now includes `hub`) rather than a standalone `hub` contract entry, because the web/Android parity gate requires every contract slug to exist in the plugin registry and the Hub is the home route (`/`), not a navigable app tile with its own registry slug.
3. Separate channels, direct messages, and system bots were dropped from the MVP (single blended channel). Revisit splitting into multiple Hub channels after feedback.
4. `GET /api/hub/channels|dms|bots` are stubs (single-channel / empty); they can be removed or formalized when/if multi-channel returns.

## Change Log

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
- Hub has no cross-plugin runtime dependency. See [112-platform-architecture-rules.mdc](../../../../.github/instructions/112-platform-architecture-rules.mdc).
- 100% web↔Android parity is the baseline. See [105-web-android-feature-parity-rules.mdc](../../../../.github/instructions/105-web-android-feature-parity-rules.mdc). No phased rollouts.

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

- [ ] Remove the hardcoded `getActionForText` routing in `use-home-chat.ts` (superseded by Feed AI Q&A).
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

- 2026-06-02: Hub peer posts now lead with the author's `@username` for signed-in members instead of the pseudonymous "Community member" label (official announcements/AI answers still show "Survivor Hub"). The Hub messages route is gated to signed-in members, so this only changes what authenticated members see; a future public Hub view would still show "Community member". Implemented Chyme-style: the poster's username is captured from their session and stored on `feed_community_posts.author_username` at post time, then surfaced through the Feed timeline. Forward-only — community posts created before this shipped have no stored username and keep showing "Community member".
- 2026-05-12: Checklist re-scoped as a task list against the canonical inventory; rules 105, 107, 112, 120 referenced; pre-merge gates assert no cross-plugin imports/fetches; phased-rollout sections removed.
- 2026-03-23: Initial checklist created under prior phase-based template.
