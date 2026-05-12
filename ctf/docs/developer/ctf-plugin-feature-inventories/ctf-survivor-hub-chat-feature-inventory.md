# Survivor Hub Feature Inventory (CTF Rewrite)

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

Deterministic Hub seed script: `ctf/scripts/seedHubPhase0.mjs`. Seeds `hub_channels`, `hub_bots` (including `@comic`), `hub_bot_routes`, and any required `hub_dm_threads` fixtures.

## Gaps and Known Technical Debt

(None recorded.)

## Change Log

- 2026-05-12: Inventory rewritten as a clean snapshot per the updated rule 120. Removed phased-rollout language, the "Risks and Known Technical Debt" TODO list, the "Production Readiness Snapshot" audit framing, and cross-plugin language about Chyme. Hub now described as a standalone plugin with its own `/api/hub/*` surface, its own `hub_*` schema, and its own GetStream scope.
- 2026-03-23: Initial inventory created under prior phase-based template.
