# Survivor Hub Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Unified hub scope slug: `hub`
- Hub is the unified Survivor Hub home/landing experience: app shell, channels, DMs, bots, routing assistant, hero stats, and plugin grid.
- Hub is a **distinct concern from the Chyme plugin**:
  - Hub owns the home page experience, sidebar nav (channels + DMs + bots), shell layout, hub-side message routing, and the @comic bot.
  - Chyme owns the social-audio room, the GetStream-backed chat persistence used as the messaging backbone, and Chyme-specific deletion. Chyme is documented in `ctf-chyme-feature-inventory.md`.
- This document captures the comprehensive spec for Hub as it must exist in `ctf/`. Items present in this spec but absent in code are tracked under "Risks and Known Technical Debt"; they are not future "phases" — they are interrupted work to resume.

---

## Intent and Outcome

The Survivor Hub is the primary entry point of CTF for both unauthenticated visitors and authenticated survivors. It provides:

1. A four-column Discord-style shell that hosts navigation (icon rail, sidebar), main content (chat or apps), and a contextual right rail.
2. Real-time text chat with the survivor community (backed by Chyme/GetStream) and a routing assistant that points users to the correct plugin for their need ("I need a place to stay" → LightHouse).
3. Channel and Direct Message surfaces, including system bots (e.g., @comic) that onboard, suggest, and route.
4. A live plugin grid that exposes all available mini-apps with deterministic sorting, recent-use tracking, and per-plugin theming.
5. Live community stats (member count, GDP value, opportunity gap) sourced from the GDP plugin.

Hub is the only surface that introduces Survivor Hub as a brand to a new visitor; the rest of CTF treats Hub as the canonical "home" route.

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

1. Hero banner with live stats from GDP plugin: member count, GDP value (USD), opportunity value (target GDP minus current GDP).
2. Hero banner copy adapts: "Welcome to Survivor Hub" for unsigned visitors; "Good morning, {displayName} — your network is active." for signed-in users.
3. Live message feed for signed-in users; message history loaded via Chyme message API (`/api/chyme/messages`), polled while shell is mounted.
4. Optimistic send via Chyme send API (`/api/chyme/messages`); dedup on display by `(from, sender, text, time)` tuple.
5. Routing assistant maps user utterances to plugin actions:
   - "housing" / "lighthouse" → LightHouse action button.
   - "gdp" / "economy" → GDP action button.
   - "service credit" → Service Credits action button.
   - "directory" / "provider" → Directory action button.
   - Routing matrix lives in `use-home-chat.ts` and must remain in sync with implemented plugins.
6. Suggestion chips pre-fill the input with canonical example utterances.
7. Hub avatar ("SH") rendered for all hub responses; routing assistant messages are visually identical to the design avatar.
8. Connection state visible as footer status (connecting, live, fallback) — live state requires successful `/api/chyme/join`.
9. Unsigned visitors see a sign-in gate in place of the input; static "Sign in to participate" treatment.

### Sidebar — Channels

1. Channel list renders in chat mode for **all users** (signed-in and unsigned).
2. Unauthenticated users see exactly one channel: `#general`, linking to `/apps/chyme`.
3. Authenticated users may see additional channels (e.g., `#housing-help`, `#skills-trade`, `#mutual-aid`) provisioned per user role / context.
4. Each channel links to its associated plugin route as a deep link.
5. Channels reflect a presence/unread state surfaced by the messaging backbone (Chyme/GetStream) when available.

### Sidebar — Direct Messages

1. DM list renders below the channel list in chat mode for signed-in users.
2. DMs may include peer-to-peer survivor conversations and system bot conversations (see Bots).
3. Each DM row shows the counterpart's display name, online indicator (when known), and unread badge (when known).
4. Selecting a DM opens the DM thread in the main content panel (DM thread surface is part of Hub, message persistence is via the Chyme/GetStream backbone).

### Sidebar — Bots

1. The hub manages a set of system bots that appear in the DM list and respond to user messages.
2. **@comic bot**: hub-owned bot. Persona: lightweight assistive bot that introduces survivor stories and onboarding nudges, and can route users to plugins. Appears in DMs and may be addressable from channels.
3. Bots are first-class entities owned by Hub and must have:
   - A canonical bot profile (slug, display name, avatar, persona/voice copy).
   - Routing rules for inbound messages (intent → bot response template or plugin handoff).
   - A deterministic seed for non-prod environments so QA, design, and Storybook surfaces render bots identically.
4. Bot messages render with the bot's avatar in the chat panel and must be visually distinguishable from human Hub-team responses.

### Hub Apps (Apps Section)

1. Three-column plugin grid driven by the live plugin registry (`listPluginRegistry`).
2. Per-plugin color theme and emoji (sourced from `shell-plugin-config.ts`).
3. Sort modes: **recent**, **alphabetical**, **most-used**. Selection persists in `localStorage` (`ctf.communityShell.pluginSortMode`).
4. Recent-use tracking persists in `localStorage` (`ctf.communityShell.recentPluginSlugs`); capped at 12 entries.
5. Most-used tracking persists in `localStorage` (`ctf.communityShell.pluginUsageCounts`).
6. Sidebar in apps mode shows a flat searchable plugin list; selection sets the active app and updates recent/used counters.
7. Search filters by name and summary.
8. Cards link to `/apps/[slug]` for each plugin.

### Mobile (Android) Parity

1. Mobile must surface the Hub home experience with feature parity to web: chat with routing assistant, channels list, DMs/bots, plugin grid.
2. Mobile uses GetStream React Native SDK for the chat surface (Chyme backbone) and must consume hub-owned routing and bot rules.
3. Mobile relies on a hub-side credentials endpoint to obtain GetStream channel access (see API Surface).

---

## Target Admin Features

1. No dedicated Hub admin UI is required for MVP beyond what the existing admin shell provides.
2. Bot management (registering bots, updating persona, toggling visibility) is a hub-owned admin contract surface. It may be operated from Retool against the bot tables for now; an in-app surface is not required.
3. Channel visibility per role/context is a hub-owned admin policy surface. It may be configured via seed/config for now; an in-app surface is not required.

---

## API Surface and Route Map (Target)

Hub-owned routes:

- `GET /api/hub/channels` — returns the channel set visible to the caller (one channel for unauthenticated, multiple for authenticated based on role/context).
- `GET /api/hub/dms` — returns the DM list for the caller, including bot DMs.
- `GET /api/hub/bots` — returns the active bot registry (slug, display name, avatar, persona blurb).
- `POST /api/survivor-hub-chat/stream` — issues GetStream credentials (apiKey, userId, userToken, chatChannelId) to the mobile Hub chat surface. This is the credentials handoff that lets the mobile feature attach to the Chyme/GetStream channel.

Cross-plugin routes consumed by Hub (owned by their respective plugins):

- `GET /api/chyme/messages` — message history for the hub chat surface.
- `POST /api/chyme/messages` — send into the hub chat surface.
- `POST /api/chyme/join` — join the GetStream channel that backs hub chat.
- `GET /api/plugins` — plugin registry feed for the Apps grid.
- `GET /api/gdp/...` — stats surfaces consumed by the hero banner.

Web entry route:

- `GET /apps` — the Hub home page (Next.js `app/apps/page.tsx`).

---

## Data Model and Storage Contracts (Target)

Hub-owned tables (canonical schema target lives in `ctf/schema.sql`):

1. `hub_channels`
   - Channel registry: `(slug PK, display_name, plugin_route, visibility_scope, ordering)`.
   - `visibility_scope`: `public | authenticated | role:<role>` controls which users see the channel.
2. `hub_bots`
   - Bot registry: `(slug PK, display_name, avatar_url, persona_blurb, is_active)`.
   - Seed must include `@comic` deterministically for non-prod environments.
3. `hub_bot_routes`
   - Bot routing rules: `(id PK, bot_slug FK, intent_pattern, response_template, plugin_handoff_slug nullable)`.
4. `hub_dm_threads`
   - DM thread tracking: `(id PK, user_id, counterpart_id_or_bot_slug, last_message_at, unread_count)`.

Cross-plugin tables consumed read-only by Hub:

- `chyme_messages`, `chyme_room_members` (Chyme plugin) — backbone for chat history and presence.
- `gdp_metric_snapshots` (GDP plugin) — hero stats source.

Notes:

- Hub tables follow the project's `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` pattern.
- Bot routing logic is data-driven; new bots/intents land via seed + admin edits, not code changes.

---

## Security, Privacy, and Compliance Controls (Target)

1. Unauthenticated visitors must see the public Hub shell (channels list shows only `#general`; chat input is sign-in-gated; no DMs or bots exposed). No leakage of authenticated channel names, DMs, or bot rosters.
2. Authenticated routes (`/api/hub/channels`, `/api/hub/dms`, `/api/hub/bots`, `/api/survivor-hub-chat/stream`, Chyme APIs) require a valid auth-provider session; reject with `401` otherwise.
3. Approved-user / admin gate enforced on chat send and bot DM interactions, matching Chyme access policy.
4. Bot routing rules are read by the server only; the client never sees a raw bot policy table.
5. Identity handles for `@mention` semantics use the canonical auth-provider username/handle, aligned to `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`.
6. Routing assistant must not exfiltrate raw user utterances to third-party services; routing is a pure server-side lookup against `hub_bot_routes`.
7. GetStream interactions are routed through shared wrappers in `ctf/packages/shared`; tokens are minted server-side and never persisted in the client beyond memory.
8. Right rail must render `displayName` derived from auth provider, never hardcoded names. When no display name is available, render the neutral fallback `Survivor`.
9. Stats in the hero banner must come from `gdp_metric_snapshots`; if data is absent, render zero/absent — never hardcoded.
10. Stub UIs (currently in DM/bot/channel lists, see Risks) must not advertise unimplemented features as available; they must be gated and clearly labeled as not yet wired.

---

## Web and Android Delivery Status

1. **Web shell** is delivered for the four-column layout, chat panel, apps panel, sidebar, right rail, hero stats, routing assistant, and plugin grid.
2. **Web channels sidebar** is delivered for the single `#general` channel; multi-channel support and live unread counts are not yet wired (see Risks).
3. **Web DMs sidebar** is rendered as a non-interactive stub; live DM routing and bot DM threads are not yet wired (see Risks).
4. **Web @comic bot** is not yet implemented as a routable entity; only a static "SH" hub avatar exists today (see Risks).
5. **Android Hub shell** is not delivered. Only a stub `MockSurvivorHubChat` and an orphan `SurvivorHubChat` component exist under `ctf/packages/mobile/src/features/survivor-hub-chat/`; neither is wired into a navigation surface, and `SurvivorHubChat` calls a non-existent endpoint (see Risks).
6. **Web+Android parity status: web-shell partial, android pending**. Parity ticket is required for any new Hub work that does not deliver Android.

---

## Seed Coverage Status

Required: deterministic Hub seed script for manual validation in dev environments.

Current status:

- No `seedHubPhase0.mjs` or equivalent exists.
- Hub depends on Chyme seeds (`seedChymePhase0.mjs`) for the messaging backbone, and on GDP seeds for hero stats. These cover the data Hub reads but do not cover hub-owned tables (`hub_channels`, `hub_bots`, `hub_bot_routes`, `hub_dm_threads`) which are not yet present in schema.

---

## Risks and Known Technical Debt

The following items are part of the Hub spec but are currently absent or incomplete in code. They are tracked here so future agents resume the work instead of treating these gaps as out-of-scope.

1. **@comic bot is not implemented.**
   - Spec calls for a hub-owned bot registry, deterministic seed for `@comic`, routing rules, and a chat avatar pipeline.
   - Code today: no `hub_bots` / `hub_bot_routes` tables, no bot APIs, no `@comic` profile or avatar; only the static "SH" Hub avatar is rendered.
   - Resume by: adding `hub_bots` and `hub_bot_routes` to `ctf/schema.sql`, seeding `@comic`, implementing `GET /api/hub/bots`, wiring the bot into the DM list and chat panel.

2. **Hub-owned channel registry is not implemented.**
   - Spec calls for `hub_channels` with visibility scope. Code today: a hardcoded `STATIC_CHANNELS` array in `shell-sidebar.tsx` containing only `#general`.
   - Resume by: adding `hub_channels` to schema, implementing `GET /api/hub/channels`, wiring sidebar to fetch channels with auth-aware visibility scope.

3. **DMs are non-interactive stubs.**
   - Spec calls for live DM threads (peer-to-peer and bot DMs) with unread/presence indicators.
   - Code today: `STATIC_DMS` in `shell-sidebar.tsx` shows hardcoded placeholder names (`Maria G.`, `James T.`, `Amara O.`) with `aria-disabled="true"` and a "Soon" badge. The disabled tooltip currently reads "Direct messages are not yet wired" and should be removed entirely once DMs are live.
   - Resume by: adding `hub_dm_threads`, implementing `GET /api/hub/dms`, wiring sidebar, building the DM thread view in the main panel, and removing the placeholder array and "phase" copy.

4. **Mobile Hub is an orphan stub.**
   - `ctf/packages/mobile/src/features/survivor-hub-chat/SurvivorHubChat.tsx` is not imported by any navigation surface.
   - It calls `POST /api/survivor-hub-chat/stream`, which does not exist on the web side. The corresponding `MockSurvivorHubChat.tsx` is a near-empty stub.
   - Resume by: implementing `POST /api/survivor-hub-chat/stream`, wiring `SurvivorHubChat` into the mobile navigation, and either deleting `MockSurvivorHubChat.tsx` or repurposing it as a Storybook fixture.

5. **Routing assistant matrix is hardcoded in `use-home-chat.ts`.**
   - Spec calls for data-driven routing via `hub_bot_routes`. Code today: a small `if/else` block inside `getActionForText`.
   - Resume by: backing the routing matrix with `hub_bot_routes` so new plugins/intents do not require code changes.

6. **Plugin parity contracts do not include Hub.**
   - `ctf/config/plugin-parity-contracts.json` has no `hub` entry. This must be added when Android delivery begins so parity drift is tracked.

7. **Plugin catalog/registry do not include Hub.**
   - `ctf/packages/web/lib/plugins/plugin-catalog.ts` and the database registry have no `hub` row. If Hub remains an app-shell-level capability that wraps the plugin grid, it should still be registered so other plugins can reference it. If Hub is reclassified as a plugin, both the catalog and the registry must include it.

8. **Schema file has no Hub tables.**
   - `ctf/schema.sql` has no `hub_*` tables. They must be added per `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` rules so fresh and legacy databases stay in sync.

9. **Contract artifacts are missing.**
   - No `HUB_PLUGIN_COMMAND_CONTRACTS.yaml`, `HUB_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`, or `HUB_PLUGIN_AUDIT_CONTRACTS.yaml` exists under `ctf/docs/contracts/`. They must be authored as Hub-owned endpoints (`/api/hub/*`, `/api/survivor-hub-chat/stream`) land.

10. **Rewrite checklist contains stale phase language.**
    - The companion checklist `ctf-survivor-hub-chat-rewrite-checklist.md` is structured around "Phase 0/1/2/3". It needs to be flattened into a single spec-aligned punch list whose items match this inventory's "Risks and Known Technical Debt" list.

---

## Rule Alignment

1. `.github/instructions/index.mdc` — CTF rewrite scope, plugin-first flows.
2. `.github/instructions/107-integration-stack-rules.mdc` — GetStream as the backbone messaging channel (consumed via Chyme).
3. `.github/instructions/116-file-size-and-modularity-rules.mdc` — Shell components split into modular sub-components; each file targets ≤ 200 lines per primary function.
4. `.github/instructions/113-platform-coding-rules.mdc` — Provider-neutral session auth; no PII in client bundles.
5. `.github/instructions/103-web-nextjs-structure-rules.mdc` — Server components fetch GDP stats and plugin registry; client components handle local chat state and storage-backed UI prefs.
6. `.github/instructions/114-single-profile-and-plugin-extension-rules.mdc` — Hub bot identities are plugin-extension-style profiles, not duplicates of the primary user profile.
7. `.github/instructions/120-plugin-feature-inventory-lifecycle-rules.mdc` — This inventory follows the canonical sections; new Hub features land here before code.
8. CTF Contract — Hub-owned chat is the "Survivor Hub assistant"; Chyme remains the social-audio plugin context.

---

## Change Log

- 2026-05-12: Inventory rewritten as a comprehensive spec. Removed phased rollout language per project policy (features are implemented or not; gaps are tracked as technical debt). Clarified Hub vs. Chyme boundary. Documented `@comic` bot, channel registry, DM registry, mobile Hub orphan, and missing API/schema/contract artifacts. Restored `#general` single channel for the unauthenticated view, with multi-channel support called out as Hub-owned to-do.
- 2026-03-23: Initial inventory created under prior phase-based template.
