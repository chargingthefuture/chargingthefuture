# Survivor Hub Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Unified hub scope slug: `hub`
- Hub is the unified Survivor Hub home/landing experience: app shell, channels, DMs, bots, routing assistant, hero stats, and plugin grid.
- Hub is a **standalone plugin with no cross-plugin dependencies**:
  - Hub owns its own data, routes, GetStream scope, channels, DMs, and bots.
  - Hub has **no runtime dependency on Chyme** (or any other plugin) and Chyme has no runtime dependency on Hub. Each plugin's GetStream usage is scoped to its own channels, users, and tokens — GetStream is a shared third-party SaaS, not a plugin.
  - Hub may render generic plugin metadata (slug, name, summary) from the plugin registry to power the Apps grid; that registry is a shared, plugin-neutral resource, not a Chyme surface.
- This document captures the comprehensive spec for Hub as it must exist in `ctf/`. Items in this spec that are absent or partial in code today are tracked under "Risks and Known Technical Debt" — they are interrupted work to resume, not future "phases".

---

## Production Readiness Snapshot

The Survivor Hub home page is **not production ready**. The chrome (4-column shell, hero banner, apps grid, right rail) is live, but every interactive surface that defines the Hub — channels, DMs, bots, routing assistant, mobile — is either stubbed or borrowing from another plugin's APIs in violation of the plugin boundary rule.

What works today:

- Four-column shell renders on `/apps` for signed-in and unsigned users.
- Apps grid is data-driven via the plugin registry.
- Right rail renders auth-provider identity and live GDP stats.
- Single `#general` channel renders for all users.

What is missing or broken:

- No Hub-owned data model, API routes, contracts, or seed.
- Hub chat currently calls `/api/chyme/*` and imports from `lib/chyme/types` — a forbidden cross-plugin dependency that must be replaced with `/api/hub/*` calls and Hub-owned types.
- `@comic` bot is fully unimplemented (no schema, no API, no avatar pipeline, no seed).
- DMs are a hardcoded, non-interactive stub.
- Channel list is hardcoded; the multi-channel spec is not wired.
- Routing assistant matrix is hardcoded in `use-home-chat.ts` rather than data-driven.
- Mobile Hub (`SurvivorHubChat`) is an orphan that calls a non-existent endpoint.
- Hub does not appear in `plugin-catalog.ts`, the plugin registry, or `plugin-parity-contracts.json`.

The "Risks and Known Technical Debt" section is the canonical punch list for getting Hub to production parity.

---

## Intent and Outcome

The Survivor Hub is the primary entry point of CTF for both unauthenticated visitors and authenticated survivors. It provides:

1. A four-column Discord-style shell that hosts navigation (icon rail, sidebar), main content (chat or apps), and a contextual right rail.
2. Real-time text chat with the survivor community on Hub-owned GetStream channels, plus a routing assistant that points users to the correct plugin for their need ("I need a place to stay" → LightHouse).
3. Channel and Direct Message surfaces, including system bots (e.g., `@comic`) that onboard, suggest, and route.
4. A live plugin grid that exposes all available mini-apps with deterministic sorting, recent-use tracking, and per-plugin theming.
5. Live community stats (member count, GDP value, opportunity gap) sourced from the GDP plugin's published snapshots.

Hub is the only surface that introduces Survivor Hub as a brand to a new visitor; the rest of CTF treats Hub as the canonical "home" route. Hub never proxies for another plugin's chat — when a user opens a plugin (e.g., Chyme, LightHouse), they leave the Hub chat surface and enter that plugin's own chat scope.

---

## Target User Features (Implementation Scope)

### Hub Shell

1. Four-column shell on `/apps`: icon rail (72px), left sidebar (240px), main content (flex), right rail (280px).
2. Section toggle between **Chat** and **Apps** controlled by icon rail buttons; section state lives in the shell, not the URL.
3. Right rail renders auth-provider username/display name (no hardcoded names) for signed-in users and a sign-in CTA for unsigned visitors.
4. Right rail "About Survivor Hub" section with live implemented-plugin count.
5. Right rail "Active Apps" list with the top implemented plugins (sorted by recent use).
6. Right rail uses provider-neutral identity contract; no PII outside approved retention boundary.
7. Sign-in and Create-Account CTAs visible in icon rail and right rail for unsigned visitors.
8. Optional hub banner ("Free to join · End-to-end encrypted") visible to unsigned visitors.

### Hub Chat (Chat Section)

1. Hero banner with live stats from GDP plugin's published snapshots: member count, GDP value (USD), opportunity value (target GDP minus current GDP).
2. Hero banner copy adapts: "Welcome to Survivor Hub" for unsigned visitors; "Good morning, {displayName} — your network is active." for signed-in users.
3. Live message feed for signed-in users on Hub-owned GetStream channel(s); history loaded via Hub-owned message API.
4. Optimistic send via Hub-owned send API; dedup on display by `(from, sender, text, time)` tuple.
5. Routing assistant maps user utterances to plugin actions:
   - "housing" / "lighthouse" → LightHouse action button.
   - "gdp" / "economy" → GDP action button.
   - "service credit" → Service Credits action button.
   - "directory" / "provider" → Directory action button.
   - Routing matrix is data-driven (`hub_bot_routes`) so new plugins/intents do not require code changes.
6. Suggestion chips pre-fill the input with canonical example utterances.
7. Hub avatar ("SH") rendered for hub-team responses; bot responses use the bot's avatar.
8. Connection state visible as footer status (connecting, live, fallback) — live state requires successful Hub-owned join.
9. Unsigned visitors see a sign-in gate in place of the input; static "Sign in to participate" treatment.

### Sidebar — Channels

1. Channel list renders in chat mode for **all users** (signed-in and unsigned).
2. Unauthenticated users see exactly one channel: `#general`.
3. Authenticated users may see additional channels (e.g., `#housing-help`, `#skills-trade`, `#mutual-aid`) provisioned per user role / context.
4. Each channel routes to its associated Hub-owned GetStream channel (not to another plugin's chat).
5. Channels reflect presence/unread state surfaced by the Hub's own GetStream scope.

### Sidebar — Direct Messages

1. DM list renders below the channel list in chat mode for signed-in users.
2. DMs may include peer-to-peer survivor conversations and system bot conversations (see Bots).
3. Each DM row shows the counterpart's display name, online indicator (when known), and unread badge (when known).
4. Selecting a DM opens the DM thread in the main content panel; message persistence runs on Hub's GetStream scope.

### Sidebar — Bots

1. The hub manages a set of system bots that appear in the DM list and respond to user messages on Hub channels and Hub DMs.
2. **`@comic` bot**: hub-owned bot. Persona: lightweight assistive bot that introduces survivor stories and onboarding nudges, and can route users to plugins. Appears in DMs and may be addressable from channels.
3. Bots are first-class Hub entities and must have:
   - A canonical bot profile (slug, display name, avatar, persona/voice copy).
   - Routing rules for inbound messages (intent → bot response template or plugin handoff).
   - A deterministic seed for non-prod environments so QA, design, and Storybook surfaces render bots identically.
4. Bot messages render with the bot's avatar and must be visually distinguishable from human Hub-team responses.

### Hub Apps (Apps Section)

1. Three-column plugin grid driven by the live plugin registry (`listPluginRegistry`). The registry is a shared, plugin-neutral resource — not a Chyme or other-plugin surface.
2. Per-plugin color theme and emoji (sourced from `shell-plugin-config.ts`).
3. Sort modes: **recent**, **alphabetical**, **most-used**. Selection persists in `localStorage` (`ctf.communityShell.pluginSortMode`).
4. Recent-use tracking persists in `localStorage` (`ctf.communityShell.recentPluginSlugs`); capped at 12 entries.
5. Most-used tracking persists in `localStorage` (`ctf.communityShell.pluginUsageCounts`).
6. Sidebar in apps mode shows a flat searchable plugin list; selection sets the active app and updates recent/used counters.
7. Search filters by name and summary.
8. Cards link to `/apps/[slug]` for each plugin.

### Mobile (Android) Parity

1. Mobile must surface the Hub home experience with feature parity to web: chat with routing assistant, channels list, DMs/bots, plugin grid.
2. Mobile uses the GetStream React Native SDK against the **Hub's own GetStream scope**. Mobile must not be wired to any other plugin's GetStream channels.
3. Mobile obtains tokens from the Hub-owned credentials endpoint (see API Surface).

---

## Target Admin Features

1. No dedicated Hub admin UI is required for MVP beyond what the existing admin shell provides.
2. Bot management (registering bots, updating persona, toggling visibility) is a Hub-owned admin contract surface. It may be operated from Retool against the Hub bot tables for now; an in-app surface is not required.
3. Channel visibility per role/context is a Hub-owned admin policy surface. It may be configured via seed/config for now; an in-app surface is not required.

---

## API Surface and Route Map (Target)

All Hub APIs are namespaced under `/api/hub/*` (or `/api/survivor-hub-chat/*` for the mobile credentials handoff already referenced in code). Hub APIs must not import from `lib/chyme/*` or any other plugin's module.

Hub-owned routes:

- `GET /api/hub/channels` — returns the channel set visible to the caller (one channel for unauthenticated, multiple for authenticated based on role/context).
- `GET /api/hub/dms` — returns the DM list for the caller, including bot DMs.
- `GET /api/hub/bots` — returns the active bot registry (slug, display name, avatar, persona blurb).
- `GET /api/hub/messages` — message history for the active Hub channel or DM thread.
- `POST /api/hub/messages` — send into a Hub channel or DM thread.
- `POST /api/hub/join` — provisions GetStream membership/token for the caller against the Hub's GetStream scope. Returns `streamApiKey`, `streamUserId`, `streamToken`, `streamChannelId`.
- `POST /api/survivor-hub-chat/stream` — credentials issuance for the mobile Hub chat surface (the route name referenced by `ctf/packages/mobile/src/features/survivor-hub-chat/fetchSurvivorHubChatStreamCredentials.ts`). May be implemented as an alias of `POST /api/hub/join`.

Shared (plugin-neutral) routes consumed by Hub:

- `GET /api/plugins` — plugin registry feed for the Apps grid.
- `GET /api/gdp/...` — published GDP stats consumed by the hero banner.

Web entry route:

- `GET /apps` — the Hub home page (Next.js `app/apps/page.tsx`).

Routes Hub must **not** call (canonical violations to clean up — see Risks):

- `GET|POST /api/chyme/messages`
- `POST /api/chyme/join`
- Anything else under `/api/chyme/*` or any other plugin namespace.

---

## Data Model and Storage Contracts (Target)

Hub-owned tables (canonical schema target lives in `ctf/schema.sql`):

1. `hub_channels`
   - Channel registry: `(slug PK, display_name, visibility_scope, stream_channel_id, ordering)`.
   - `visibility_scope`: `public | authenticated | role:<role>` controls which users see the channel.
   - `stream_channel_id` references the Hub's GetStream channel identifier.
2. `hub_bots`
   - Bot registry: `(slug PK, display_name, avatar_url, persona_blurb, is_active)`.
   - Seed must include `@comic` deterministically for non-prod environments.
3. `hub_bot_routes`
   - Bot routing rules: `(id PK, bot_slug FK, intent_pattern, response_template, plugin_handoff_slug nullable)`.
4. `hub_dm_threads`
   - DM thread tracking: `(id PK, user_id, counterpart_id_or_bot_slug, stream_channel_id, last_message_at, unread_count)`.
5. `hub_messages`
   - Hub message persistence shadowing the GetStream channel: `(id PK, stream_channel_id, sender_user_id, body, sent_at)`. Used for transcript auditing and routing analytics. Independent of any other plugin's message table.

Shared (plugin-neutral) tables consumed read-only by Hub:

- `gdp_metric_snapshots` (GDP plugin) — hero stats source.
- Plugin registry table that powers `/api/plugins`.

Hub must not read or write any Chyme table (e.g., `chyme_messages`, `chyme_room_members`) or any other plugin's tables.

Notes:

- Hub tables follow the project's `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` pattern.
- Bot routing logic is data-driven; new bots/intents land via seed + admin edits, not code changes.

---

## Security, Privacy, and Compliance Controls (Target)

1. Unauthenticated visitors must see the public Hub shell (channels list shows only `#general`; chat input is sign-in-gated; no DMs or bots exposed). No leakage of authenticated channel names, DMs, or bot rosters.
2. Authenticated routes (`/api/hub/*`, `/api/survivor-hub-chat/stream`) require a valid auth-provider session; reject with `401` otherwise.
3. Approved-user / admin gate enforced on Hub chat send and bot DM interactions.
4. Bot routing rules are read by the server only; the client never sees a raw bot policy table.
5. Identity handles for `@mention` semantics use the canonical auth-provider username/handle, aligned to `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`.
6. Routing assistant must not exfiltrate raw user utterances to third-party services; routing is a pure server-side lookup against `hub_bot_routes`.
7. GetStream interactions are scoped to the Hub's own GetStream channels/users/tokens via shared wrappers in `ctf/packages/shared`. Hub tokens must never be reused for another plugin's channels and vice versa.
8. Right rail must render `displayName` derived from auth provider, never hardcoded names. When no display name is available, render the neutral fallback `Survivor`.
9. Stats in the hero banner must come from `gdp_metric_snapshots`; if data is absent, render zero/absent — never hardcoded.
10. Stub UIs (currently in DM/bot/channel lists, see Risks) must not advertise unimplemented features as available; they must be gated and clearly labeled as not yet wired.

---

## Web and Android Delivery Status

1. **Web shell chrome** (layout, hero, apps panel, right rail, single `#general` channel) is delivered.
2. **Web chat behavior** is partially delivered but currently runs against `/api/chyme/*` — this is a plugin-boundary violation that must be replaced with `/api/hub/*`.
3. **Web multi-channel sidebar** is not delivered.
4. **Web DMs** are rendered as a hardcoded non-interactive stub; not delivered.
5. **Web `@comic` bot** is not delivered.
6. **Android Hub shell** is not delivered. Only an orphan `SurvivorHubChat` component and a stub `MockSurvivorHubChat` exist under `ctf/packages/mobile/src/features/survivor-hub-chat/`; neither is wired into a navigation surface, and `SurvivorHubChat` calls the not-yet-implemented `POST /api/survivor-hub-chat/stream` endpoint.
7. **Web+Android parity status: not delivered**. Parity ticket is required for any new Hub work until both surfaces match.

---

## Seed Coverage Status

Required: deterministic Hub seed script for manual validation in dev environments.

Current status:

- No `seedHub.mjs` (or equivalent) exists.
- No Hub-owned schema rows are seeded today because no Hub-owned tables exist yet.
- GDP seeds cover the stats Hub reads from `gdp_metric_snapshots`.

---

## Risks and Known Technical Debt

The following items are part of the Hub spec but are absent or incomplete in code. They are tracked here so future agents resume the work instead of treating these gaps as out-of-scope. The list is canonical; the rewrite checklist mirrors it.

1. **Hub chat depends on Chyme APIs (plugin boundary violation).**
   - `ctf/packages/web/components/community-shell/use-home-chat.ts` imports types from `lib/chyme/types` and calls `/api/chyme/messages` and `/api/chyme/join`.
   - This violates the rule that no plugin may depend on another plugin at runtime. Hub must operate on its own GetStream scope.
   - Resume by: implementing `/api/hub/messages`, `/api/hub/join`, `/api/hub/channels`; adding Hub-owned types in `ctf/packages/web/lib/hub/types.ts`; replacing `lib/chyme/*` imports and `/api/chyme/*` fetches in `use-home-chat.ts`; deleting any incidental Chyme touchpoints from the shell.

2. **`@comic` bot is not implemented.**
   - Spec calls for a Hub-owned bot registry, deterministic seed for `@comic`, routing rules, and a chat avatar pipeline.
   - Code today: no `hub_bots` / `hub_bot_routes` tables, no bot APIs, no `@comic` profile or avatar; only the static "SH" Hub avatar is rendered.
   - Resume by: adding `hub_bots` and `hub_bot_routes` to `ctf/schema.sql`, seeding `@comic`, implementing `GET /api/hub/bots`, wiring the bot into the DM list and chat panel.

3. **Hub-owned channel registry is not implemented.**
   - Spec calls for `hub_channels` with visibility scope tied to a Hub GetStream channel ID. Code today: a hardcoded `STATIC_CHANNELS` array in `shell-sidebar.tsx` containing only `#general` and linking to `/apps/chyme` (another boundary leak).
   - Resume by: adding `hub_channels` to schema, implementing `GET /api/hub/channels`, wiring sidebar to fetch channels with auth-aware visibility scope, and removing the `/apps/chyme` link target.

4. **DMs are non-interactive stubs.**
   - Spec calls for live DM threads (peer-to-peer and bot DMs) on Hub's GetStream scope with unread/presence indicators.
   - Code today: `STATIC_DMS` in `shell-sidebar.tsx` shows hardcoded placeholder names (`Maria G.`, `James T.`, `Amara O.`) with `aria-disabled="true"` and a "Soon" badge. The disabled tooltip currently reads "Direct messages are not yet wired" and should be removed entirely once DMs are live.
   - Resume by: adding `hub_dm_threads`, implementing `GET /api/hub/dms`, wiring sidebar, building the DM thread view in the main panel, and removing the placeholder array.

5. **Mobile Hub is an orphan stub.**
   - `ctf/packages/mobile/src/features/survivor-hub-chat/SurvivorHubChat.tsx` is not imported by any navigation surface.
   - It calls `POST /api/survivor-hub-chat/stream`, which does not exist on the web side. The corresponding `MockSurvivorHubChat.tsx` is a near-empty stub.
   - Resume by: implementing `POST /api/survivor-hub-chat/stream` against Hub's GetStream scope, wiring `SurvivorHubChat` into the mobile navigation, and either deleting `MockSurvivorHubChat.tsx` or repurposing it as a Storybook fixture.

6. **Routing assistant matrix is hardcoded in `use-home-chat.ts`.**
   - Spec calls for data-driven routing via `hub_bot_routes`. Code today: a small `if/else` block inside `getActionForText`.
   - Resume by: backing the routing matrix with `hub_bot_routes` so new plugins/intents do not require code changes.

7. **Plugin parity contracts do not include Hub.**
   - `ctf/config/plugin-parity-contracts.json` has no `hub` entry. This must be added when Android delivery begins so parity drift is tracked.

8. **Plugin catalog/registry do not include Hub.**
   - `ctf/packages/web/lib/plugins/plugin-catalog.ts` and the database registry have no `hub` row. Hub must be registered consistently across the catalog, the runtime registry, and the parity contracts.

9. **Schema file has no Hub tables.**
   - `ctf/schema.sql` has no `hub_*` tables. They must be added per `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` rules so fresh and legacy databases stay in sync.

10. **Contract artifacts are missing.**
    - No `HUB_PLUGIN_COMMAND_CONTRACTS.yaml`, `HUB_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`, `HUB_PLUGIN_AUDIT_CONTRACTS.yaml`, or `HUB_PROFILE_AND_DELETION_CONTRACT.md` exists under `ctf/docs/contracts/`. They must be authored as Hub-owned endpoints land.

11. **Hub GetStream wrappers are missing.**
    - Shared GetStream adapters in `ctf/packages/shared` are scoped to other plugins today. Hub needs its own server-side adapter that mints tokens against Hub's GetStream user IDs and channel IDs (distinct from any other plugin's scope).

---

## Rule Alignment

1. `.github/instructions/index.mdc` — CTF rewrite scope, plugin-first flows.
2. `.github/instructions/107-integration-stack-rules.mdc` — GetStream as a shared third-party SaaS; each plugin scopes its own usage and there is no cross-plugin runtime dependency.
3. `.github/instructions/102-shared-boundary-rules.mdc` — No plugin may depend on another plugin's API surface, types, or tables at runtime.
4. `.github/instructions/116-file-size-and-modularity-rules.mdc` — Shell components split into modular sub-components; each file targets ≤ 200 lines per primary function.
5. `.github/instructions/113-platform-coding-rules.mdc` — Provider-neutral session auth; no PII in client bundles.
6. `.github/instructions/103-web-nextjs-structure-rules.mdc` — Server components fetch GDP stats and plugin registry; client components handle local chat state and storage-backed UI prefs.
7. `.github/instructions/114-single-profile-and-plugin-extension-rules.mdc` — Hub bot identities are plugin-extension-style profiles, not duplicates of the primary user profile.
8. `.github/instructions/120-plugin-feature-inventory-lifecycle-rules.mdc` — This inventory follows the canonical sections; new Hub features land here before code.

---

## Change Log

- 2026-05-12: Inventory rewritten to remove all cross-plugin dependencies on Chyme. Hub now scoped with its own GetStream channels, its own `hub_messages`, its own `/api/hub/*` surface, and its own credentials issuance (`POST /api/hub/join`, `POST /api/survivor-hub-chat/stream`). Added explicit "Production Readiness Snapshot" — Hub is not production ready. Recorded the current `/api/chyme/*` usage in `use-home-chat.ts` as a plugin-boundary violation (Risk #1) to clean up.
- 2026-05-12 (earlier): Inventory rewritten as a comprehensive spec. Removed phased rollout language per project policy (features are implemented or not; gaps are tracked as technical debt). Documented `@comic` bot, channel registry, DM registry, mobile Hub orphan, and missing API/schema/contract artifacts. Restored `#general` single channel for the unauthenticated view, with multi-channel support called out as Hub-owned to-do.
- 2026-03-23: Initial inventory created under prior phase-based template.
