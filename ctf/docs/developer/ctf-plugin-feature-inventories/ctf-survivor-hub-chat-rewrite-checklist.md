# Survivor Hub Rewrite Checklist

## Scope

- Rewrite target: `ctf/packages/web`, `ctf/packages/mobile`, `ctf/schema.sql`, `ctf/docs/contracts`
- Surface: Survivor Hub home experience (`community-shell` + supporting APIs and schema)
- Reference spec: `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-survivor-hub-chat-feature-inventory.md`
- Hub has **no cross-plugin runtime dependency**. Hub uses GetStream against its own scope. Hub must not import from `lib/chyme/*` or call any other plugin's API routes.
- There is no phased rollout — each item is either delivered or open work, and the inventory's "Risks and Known Technical Debt" section is the canonical list of remaining work. The page is not production ready until the Open Work below is closed.

---

## Delivered

- [x] Discord-style 4-column layout: icon rail (72px), left sidebar (240px), main content (flex), right rail (280px).
- [x] Section toggle (Chat / Apps) controlled by icon rail buttons.
- [x] Chat panel: hero banner with live stats from GDP plugin data.
- [x] Chat panel: suggestion chips that pre-fill the input.
- [x] Apps panel: 3-column plugin grid driven by live plugin registry, with per-plugin color theming.
- [x] Apps panel: sort modes (recent, alphabetical, most-used) persisted in `localStorage`.
- [x] Apps panel: recent-use and most-used tracking persisted in `localStorage`.
- [x] Sidebar (chat mode): `#general` channel rendered for both signed-in and unsigned users.
- [x] Sidebar (apps mode): flat searchable plugin list with active-state highlight.
- [x] Right rail: auth-provider username/display name rendered (no hardcoded names).
- [x] Right rail: GDP stats rendered from live data, zero/absent when no published GDP.
- [x] Right rail: top implemented plugin list.
- [x] Right rail: sign-in / create-account CTAs for unsigned visitors.
- [x] Modularity: shell components split per rule 116 (≤ 200 lines per primary function/file).
- [x] No hardcoded stat values — all stats sourced from live data or rendered as zero/absent.

## Open Work (mirrors the inventory's "Risks and Known Technical Debt")

### Remove Cross-Plugin Dependency on Chyme (boundary violation — top priority)

- [ ] Replace `lib/chyme/types` imports in `use-home-chat.ts` with Hub-owned types under `ctf/packages/web/lib/hub/types.ts`.
- [ ] Replace `GET /api/chyme/messages` / `POST /api/chyme/messages` / `POST /api/chyme/join` calls with Hub-owned equivalents.
- [ ] Replace the `#general` channel's `href` (currently `/apps/chyme`) with the canonical Hub channel route once channel data is loaded from `/api/hub/channels`.
- [ ] Audit the rest of `community-shell/` for any remaining Chyme imports, types, fetches, or styling assumptions.

### Hub-Owned Schema

- [ ] Add `hub_channels` to `ctf/schema.sql` (slug PK, display_name, visibility_scope, stream_channel_id, ordering).
- [ ] Add `hub_bots` to `ctf/schema.sql` (slug PK, display_name, avatar_url, persona_blurb, is_active).
- [ ] Add `hub_bot_routes` to `ctf/schema.sql` (id PK, bot_slug FK, intent_pattern, response_template, plugin_handoff_slug nullable).
- [ ] Add `hub_dm_threads` to `ctf/schema.sql` (id PK, user_id, counterpart_id_or_bot_slug, stream_channel_id, last_message_at, unread_count).
- [ ] Add `hub_messages` to `ctf/schema.sql` (id PK, stream_channel_id, sender_user_id, body, sent_at).
- [ ] Each new table follows `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`.

### Hub-Owned GetStream Scope

- [ ] Add Hub-owned GetStream adapter under `ctf/packages/shared` (separate user-id prefix and channel-id namespace from any other plugin).
- [ ] Wire `POST /api/hub/join` and `POST /api/survivor-hub-chat/stream` to issue tokens against Hub's GetStream scope only.

### Hub-Owned API Routes

- [ ] `GET /api/hub/channels` — returns the channel set visible to caller (single `#general` for unauthenticated; multiple for authenticated).
- [ ] `GET /api/hub/dms` — returns DM list for caller, including bot DMs.
- [ ] `GET /api/hub/bots` — returns active bot registry (slug, display name, avatar, persona blurb).
- [ ] `GET /api/hub/messages` — message history for the active Hub channel or DM thread.
- [ ] `POST /api/hub/messages` — send into Hub channel/DM.
- [ ] `POST /api/hub/join` — GetStream credentials for Hub's scope.
- [ ] `POST /api/survivor-hub-chat/stream` — alias used by mobile; may delegate to `POST /api/hub/join`.

### @Comic Bot

- [ ] Author canonical `@comic` bot profile (display name, avatar, persona blurb) and add to `hub_bots` seed.
- [ ] Author routing rules in `hub_bot_routes` (intent patterns → response templates / plugin handoffs).
- [ ] Wire `@comic` into the DM list via `/api/hub/dms`.
- [ ] Render `@comic` avatar in the chat panel for bot-routed messages.
- [ ] Ensure bot identity is visually distinguishable from human Hub-team responses.

### Sidebar — Channels (multi-channel)

- [ ] Replace `STATIC_CHANNELS` in `shell-sidebar.tsx` with data fetched from `GET /api/hub/channels`.
- [ ] Respect `visibility_scope` so unauthenticated callers receive only `#general`.
- [ ] Surface unread/presence indicators from Hub's GetStream scope when available.

### Sidebar — DMs (interactive)

- [ ] Replace `STATIC_DMS` in `shell-sidebar.tsx` with data fetched from `GET /api/hub/dms`.
- [ ] Build the DM thread view inside the main content panel.
- [ ] Remove `aria-disabled="true"`, the "Soon" badge, and the "Direct messages are not yet wired" placeholder copy once the feature lands.

### Routing Matrix (data-driven)

- [ ] Replace the hardcoded `getActionForText` matrix in `use-home-chat.ts` with a server-side lookup against `hub_bot_routes`.
- [ ] Cache the routing matrix on the client per session; refresh on channel switch.

### Mobile Hub

- [ ] Wire `SurvivorHubChat` into the mobile navigation surface.
- [ ] Confirm `fetchSurvivorHubChatStreamCredentials` aligns with the new `POST /api/survivor-hub-chat/stream` payload.
- [ ] Delete or repurpose `MockSurvivorHubChat.tsx` (Storybook fixture vs. removal).
- [ ] Reach feature parity with the web Hub: chat panel with routing assistant, channels list, DMs/bots, plugin grid.
- [ ] Add a `hub` entry to `ctf/config/plugin-parity-contracts.json`.

### Plugin Catalog / Registry

- [ ] Add `hub` to `ctf/packages/web/lib/plugins/plugin-catalog.ts`.
- [ ] Add `hub` to the plugin registry seed and `lib/plugins/repository.ts` fallback list.
- [ ] Keep the catalog, registry, and parity contracts in sync.

### Contracts

- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_COMMAND_CONTRACTS.yaml` covering `/api/hub/*` and `/api/survivor-hub-chat/stream`.
- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml` with role requirements and unauthenticated visibility rules.
- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_AUDIT_CONTRACTS.yaml` for bot/DM/channel events worth auditing.
- [ ] Author `ctf/docs/contracts/HUB_PROFILE_AND_DELETION_CONTRACT.md` for user-scoped Hub state (DM threads, recent counters, message persistence).

### Seed Coverage

- [ ] Add `ctf/scripts/seedHubPhase0.mjs` (or `seedHub.mjs` — match peer naming) that deterministically seeds `hub_channels`, `hub_bots` (including `@comic`), `hub_bot_routes`.

---

## Pre-Release Gates

- [ ] No imports from `lib/chyme/*` (or any other plugin's `lib/*`) in any file under `ctf/packages/web/components/community-shell/`, `ctf/packages/web/app/apps/`, or `ctf/packages/mobile/src/features/survivor-hub-chat/`.
- [ ] No `fetch('/api/chyme/...')` (or any other plugin's API) from Hub surfaces.
- [ ] Visual QA against the canonical Survivor Hub desktop mockup in `design/`.
- [ ] Mobile responsive layout checked at 900px and 1200px breakpoints.
- [ ] GDP stats display zero/absent (not hardcoded) when no published GDP data exists.
- [ ] Right rail shows provider-backed first name or username, not placeholder "Survivor" hardcoded text when user is signed in.
- [ ] Auth-provider account control renders in icon rail for signed-in users.
- [ ] No TypeScript errors in `community-shell` component tree.
- [ ] ESLint passes with zero warnings (`pnpm lint`).
- [ ] Plugin card "Open plugin →" links navigate to correct `/apps/[slug]` routes.
- [ ] Channel links navigate to Hub's own channel routes (no cross-plugin links).
- [ ] Unauthenticated users see exactly one channel (`#general`) and no DMs / bots / sign-in-gated CTAs.

---

## Change Log

- 2026-05-12: Open Work re-ordered; top priority is removing the cross-plugin dependency on Chyme. Added Hub-owned GetStream scope and `hub_messages` table. Updated pre-release gates to assert no `lib/chyme/*` imports and no `/api/chyme/*` fetches from Hub.
- 2026-05-12 (earlier): Checklist flattened — phased rollout sections removed per project policy. Items reorganized into "Delivered" vs. "Open Work" so each line item maps directly to the inventory's "Risks and Known Technical Debt" entries.
- 2026-03-23: Initial checklist created under prior phase-based template.
