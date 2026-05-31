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
- Plugin slug: `hub`.
- Hub owns the unified Survivor Hub home/landing experience: app shell, channels, DMs, bots, routing assistant, hero stats, and plugin grid.
- Hub is a standalone plugin with no cross-plugin runtime dependency. See [112-platform-architecture-rules.mdc](../../../../.github/instructions/112-platform-architecture-rules.mdc).
- Hub owns its own GetStream scope (channels, user IDs, tokens) per [107-integration-stack-rules.mdc](../../../../.github/instructions/107-integration-stack-rules.mdc).

## Intent and Outcome

The Survivor Hub is the primary entry point of CTF for both unauthenticated visitors and authenticated survivors. It provides the home shell, the channels and DMs sidebar, the system bots (including `@comic`), the routing assistant chat, the live hero stats, and the plugin grid. Hub is the canonical "home" route; opening a plugin moves the user out of the Hub chat surface and into that plugin's own scope.

## Target User Features

### Hub Shell

1. Four-column layout on `/apps`: icon rail (72px), left sidebar (240px), main content (flex), right rail (280px).
2. Section toggle between **Chat** and **Apps** controlled by icon rail buttons; section state is shell-local.
3. Right rail renders auth-provider username/display name for signed-in users and a sign-in CTA for unsigned visitors.
4. Right rail "About Survivor Hub" section with live implemented-plugin count.
5. Right rail "Active Apps" list with the top implemented plugins (sorted by recent use).
6. Sign-in and Create-Account CTAs visible in icon rail and right rail for unsigned visitors.
7. Hero banner ("Free to join · End-to-end encrypted") visible to unsigned visitors.

### Hub Chat (Chat Section)

1. Hero banner with live stats from the platform-owned GDP snapshot table: member count, GDP value (USD), opportunity value (target GDP minus current GDP).
2. Hero banner copy adapts: "Welcome to Survivor Hub" for unsigned visitors; "Good morning, {displayName} — your network is active." for signed-in users.
3. Live message feed for signed-in users on Hub-owned GetStream channels; history loaded via `GET /api/hub/messages`, polled while shell is mounted.
4. Optimistic send via `POST /api/hub/messages`; dedup on display by `(from, sender, text, time)` tuple.
5. Routing assistant maps user utterances to plugin action buttons via the data-driven `hub_bot_routes` table.
6. Suggestion chips pre-fill the input with canonical example utterances.
7. Hub avatar ("SH") rendered for hub-team responses; bot responses use the bot's avatar.
8. Connection state visible as footer status (connecting, live, fallback); live state requires a successful `POST /api/hub/join`.
9. Unsigned visitors see a sign-in gate in place of the input.

### Sidebar — Channels

1. Channel list renders in chat mode for all users.
2. Unauthenticated users see exactly one channel: `#general`.
3. Authenticated users see additional channels (e.g., `#housing-help`, `#skills-trade`, `#mutual-aid`) provisioned per role/context via `hub_channels.visibility_scope`.
4. Each channel routes to its associated Hub-owned GetStream channel.
5. Channels reflect presence/unread state from Hub's GetStream scope.

### Sidebar — Direct Messages

1. DM list renders below the channel list in chat mode for signed-in users.
2. DMs include peer-to-peer survivor conversations and system bot conversations.
3. Each DM row shows the counterpart's display name, online indicator, and unread badge.
4. Selecting a DM opens the DM thread in the main content panel; message persistence runs on Hub's GetStream scope.

### Sidebar — Bots

1. The hub manages system bots that appear in the DM list and respond on Hub channels and Hub DMs.
2. `@comic` bot: hub-owned bot. Persona: lightweight assistive bot that introduces survivor stories and onboarding nudges, and routes users to plugins. Appears in DMs and is addressable from channels.
3. Bots are first-class Hub entities with a canonical profile (slug, display name, avatar, persona copy), routing rules in `hub_bot_routes`, and deterministic seed coverage.
4. Bot messages render with the bot's avatar and are visually distinguishable from human Hub-team responses.

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

1. Bot management (registering bots, updating persona, toggling visibility) is a Hub-owned admin contract surface operated via Retool against `hub_bots` and `hub_bot_routes`.
2. Channel visibility per role/context is a Hub-owned admin policy surface configured via seed/config against `hub_channels.visibility_scope`.

## API Surface and Route Map

All Hub APIs are namespaced under `/api/hub/*`. The `/api/survivor-hub-chat/stream` route is an alias for the mobile credentials handoff and delegates to `POST /api/hub/join`.

- `GET /api/hub/channels` — channel set visible to the caller, filtered by `visibility_scope`.
- `GET /api/hub/dms` — DM list for the caller, including bot DMs.
- `GET /api/hub/bots` — active bot registry (slug, display name, avatar, persona blurb).
- `GET /api/hub/messages` — message history for the active Hub channel or DM thread.
- `POST /api/hub/messages` — send into a Hub channel or DM thread.
- `POST /api/hub/join` — GetStream membership/token issuance for Hub's scope. Returns `streamApiKey`, `streamUserId`, `streamToken`, `streamChannelId`.
- `POST /api/survivor-hub-chat/stream` — mobile credentials alias; delegates to `POST /api/hub/join`.

Web entry route:

- `GET /apps` — Hub home page (Next.js `app/apps/page.tsx`).

## Data Model and Storage Contracts

Hub-owned tables (canonical schema in `ctf/schema.sql`):

1. `hub_channels` — `(slug PK, display_name, visibility_scope, stream_channel_id, ordering)`. `visibility_scope`: `public | authenticated | role:<role>`.
2. `hub_bots` — `(slug PK, display_name, avatar_url, persona_blurb, is_active)`. Seed includes `@comic` deterministically.
3. `hub_bot_routes` — `(id PK, bot_slug FK, intent_pattern, response_template, plugin_handoff_slug nullable)`.
4. `hub_dm_threads` — `(id PK, user_id, counterpart_id_or_bot_slug, stream_channel_id, last_message_at, unread_count)`.
5. `hub_messages` — `(id PK, stream_channel_id, sender_user_id, body, sent_at)`.

Platform-neutral tables consumed read-only by Hub:

- `gdp_metric_snapshots` (platform-owned) — hero stats source.
- Plugin registry table behind `GET /api/plugins` (platform-owned) — Apps grid source.

Hub-owned tables follow `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`.

## Security, Privacy, and Compliance Controls

1. Unauthenticated visitors see only the public Hub shell: `#general` channel, sign-in-gated chat input, no DMs or bots exposed.
2. Authenticated routes (`/api/hub/*`, `/api/survivor-hub-chat/stream`) require a valid auth-provider session; reject with `401` otherwise.
3. Approved-user / admin gate enforced on Hub chat send and bot DM interactions.
4. Bot routing rules are server-side only; the client never sees a raw bot policy table.
5. Identity handles for `@mention` semantics use the canonical auth-provider username/handle per `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`.
6. Routing assistant is a pure server-side lookup against `hub_bot_routes`; user utterances are not forwarded to third-party LLMs.
7. GetStream interactions are scoped to Hub's channels/users/tokens via shared wrappers in `ctf/packages/shared`. Hub tokens are not reused for any other plugin's channels.
8. Right rail renders `displayName` derived from auth provider, never hardcoded names; falls back to `Survivor` when no display name is available.
9. Hero stats come from `gdp_metric_snapshots`; render zero/absent when data is missing.

## Web and Android Delivery Status

Parity status: **web+android complete**.

## Seed Coverage Status

Deterministic Hub seed script: `ctf/scripts/seedHub.mjs`. Seeds `hub_channels`, `hub_bots` (including `@comic`), `hub_bot_routes`, and any required `hub_dm_threads` fixtures.

## Gaps and Known Technical Debt

(None recorded.)

## Change Log

- 2026-05-12: Inventory rewritten as a clean snapshot per the updated rule 120. Removed phased-rollout language, the "Risks and Known Technical Debt" TODO list, the "Production Readiness Snapshot" audit framing, and cross-plugin language about Chyme. Hub now described as a standalone plugin with its own `/api/hub/*` surface, its own `hub_*` schema, and its own GetStream scope.
- 2026-03-23: Initial inventory created under prior phase-based template.


## Build Checklist


### Scope

- Rewrite target: `ctf/packages/web`, `ctf/packages/mobile`, `ctf/schema.sql`, `ctf/docs/contracts`.
- Surface: Survivor Hub home experience (`community-shell` + supporting APIs and schema).
- Canonical spec: `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-survivor-hub-chat-feature-inventory.md`.
- Hub has no cross-plugin runtime dependency. See [112-platform-architecture-rules.mdc](../../../../.github/instructions/112-platform-architecture-rules.mdc).
- 100% web↔Android parity is the baseline. See [105-web-android-feature-parity-rules.mdc](../../../../.github/instructions/105-web-android-feature-parity-rules.mdc). No phased rollouts.

This checklist tracks the work needed to bring code into alignment with the inventory. The inventory is the spec; this file is the punch list.

---

### Punch List

#### Remove Cross-Plugin Dependency on Chyme (top priority)

- [ ] Replace `lib/chyme/types` imports in `ctf/packages/web/components/community-shell/use-home-chat.ts` with Hub-owned types under `ctf/packages/web/lib/hub/types.ts`.
- [ ] Replace `GET /api/chyme/messages` / `POST /api/chyme/messages` / `POST /api/chyme/join` calls with `/api/hub/messages` and `/api/hub/join`.
- [ ] Replace the `#general` channel's `href` (currently `/apps/chyme`) with the canonical Hub channel route once channel data is loaded from `/api/hub/channels`.
- [ ] Audit the rest of `community-shell/` and `app/apps/` for any remaining Chyme imports, types, fetches, or styling assumptions.

#### Hub-Owned Schema

- [ ] Add `hub_channels` to `ctf/schema.sql`.
- [ ] Add `hub_bots` to `ctf/schema.sql`.
- [ ] Add `hub_bot_routes` to `ctf/schema.sql`.
- [ ] Add `hub_dm_threads` to `ctf/schema.sql`.
- [ ] Add `hub_messages` to `ctf/schema.sql`.
- [ ] Each new table follows `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`.

#### Hub-Owned GetStream Scope

- [ ] Add Hub-owned GetStream adapter under `ctf/packages/shared` (separate user-id prefix and channel-id namespace from any other plugin).
- [ ] Wire `POST /api/hub/join` and `POST /api/survivor-hub-chat/stream` to issue tokens against Hub's GetStream scope only.

#### Hub-Owned API Routes

- [ ] `GET /api/hub/channels`.
- [ ] `GET /api/hub/dms`.
- [ ] `GET /api/hub/bots`.
- [ ] `GET /api/hub/messages`.
- [ ] `POST /api/hub/messages`.
- [ ] `POST /api/hub/join`.
- [ ] `POST /api/survivor-hub-chat/stream` (alias delegating to `POST /api/hub/join`).

#### `@comic` Bot

- [ ] Author canonical `@comic` bot profile and add to `hub_bots` seed.
- [ ] Author routing rules in `hub_bot_routes`.
- [ ] Wire `@comic` into the DM list via `/api/hub/dms`.
- [ ] Render `@comic` avatar in the chat panel for bot-routed messages.

#### Sidebar — Channels

- [ ] Replace `STATIC_CHANNELS` in `shell-sidebar.tsx` with data fetched from `GET /api/hub/channels`.
- [ ] Respect `visibility_scope` so unauthenticated callers receive only `#general`.

#### Sidebar — DMs

- [ ] Replace `STATIC_DMS` in `shell-sidebar.tsx` with data fetched from `GET /api/hub/dms`.
- [ ] Build the DM thread view inside the main content panel.
- [ ] Remove the disabled-state markup and tooltip strings once DMs are live.

#### Routing Matrix (data-driven)

- [ ] Replace the hardcoded `getActionForText` matrix in `use-home-chat.ts` with a server-side lookup against `hub_bot_routes`.

#### Mobile Hub (parity)

- [ ] Wire `SurvivorHubChat` into the mobile navigation surface.
- [ ] Align `fetchSurvivorHubChatStreamCredentials` with `POST /api/survivor-hub-chat/stream`.
- [ ] Delete `MockSurvivorHubChat.tsx` or repurpose it as a Storybook fixture.
- [ ] Reach feature parity with the web Hub: chat panel with routing assistant, channels list, DMs/bots, plugin grid.
- [ ] Add a `hub` entry to `ctf/config/plugin-parity-contracts.json`.

#### Plugin Catalog / Registry

- [ ] Add `hub` to `ctf/packages/web/lib/plugins/plugin-catalog.ts`.
- [ ] Add `hub` to the plugin registry seed and `lib/plugins/repository.ts` fallback list.

#### Contracts

- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_COMMAND_CONTRACTS.yaml`.
- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`.
- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_AUDIT_CONTRACTS.yaml`.
- [ ] Author `ctf/docs/contracts/HUB_PROFILE_AND_DELETION_CONTRACT.md`.

#### Seed Coverage

- [ ] Add `ctf/scripts/seedHub.mjs` that deterministically seeds `hub_channels`, `hub_bots` (including `@comic`), `hub_bot_routes`.

---

### Pre-Merge Gates

- [ ] No imports from `lib/chyme/*` or any other plugin's `lib/*` in `ctf/packages/web/components/community-shell/`, `ctf/packages/web/app/apps/`, or `ctf/packages/mobile/src/features/survivor-hub-chat/`.
- [ ] No `fetch('/api/chyme/...')` (or any other plugin's API) from Hub surfaces.
- [ ] Visual QA against the canonical Survivor Hub desktop mockup in `design/`.
- [ ] Mobile responsive layout checked at 900px and 1200px breakpoints.
- [ ] GDP stats display zero/absent (not hardcoded) when no published GDP data exists.
- [ ] Right rail shows provider-backed first name or username, never hardcoded text, for signed-in users.
- [ ] Auth-provider account control renders in icon rail for signed-in users.
- [ ] No TypeScript errors in `community-shell` component tree.
- [ ] ESLint passes with zero warnings (`pnpm lint`).
- [ ] Plugin card "Open plugin →" links navigate to correct `/apps/[slug]` routes.
- [ ] Channel links navigate to Hub's own channel routes (no cross-plugin links).
- [ ] Unauthenticated users see exactly one channel (`#general`) and no DMs / bots / authenticated-only CTAs.
- [ ] Inventory updated to reflect the merged code state (Change Log entry added).

---

### Change Log

- 2026-05-12: Checklist re-scoped as a punch list against the canonical inventory; rules 105, 107, 112, 120 referenced; pre-merge gates assert no cross-plugin imports/fetches; phased-rollout sections removed.
- 2026-03-23: Initial checklist created under prior phase-based template.
