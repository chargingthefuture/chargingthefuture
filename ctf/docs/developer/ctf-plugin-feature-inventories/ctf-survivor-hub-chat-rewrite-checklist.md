# Survivor Hub Rewrite Checklist

## Scope

- Rewrite target: `ctf/packages/web`, `ctf/packages/mobile`, `ctf/schema.sql`, `ctf/docs/contracts`
- Surface: Survivor Hub home experience (`community-shell` + supporting APIs and schema)
- Reference spec: `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-survivor-hub-chat-feature-inventory.md`
- This checklist tracks Hub items end-to-end. There is no phased rollout — each item is either delivered or open work, and the inventory's "Risks and Known Technical Debt" section is the canonical list of remaining work.

---

## Delivered

- [x] Discord-style 4-column layout: icon rail (72px), left sidebar (240px), main content (flex), right rail (280px).
- [x] Section toggle (Chat / Apps) controlled by icon rail buttons.
- [x] Chat panel: hero banner with live stats from GDP plugin data.
- [x] Chat panel: input field + send button wired to Chyme send API for signed-in users.
- [x] Chat panel: suggestion chips that pre-fill the input.
- [x] Chat panel: hardcoded routing matrix maps utterances to plugin action buttons (LightHouse, GDP, Service Credits, Directory).
- [x] Chat panel: live message history via Chyme messages API with polling refresh.
- [x] Chat panel: unsigned-visitor variant shows sign-in CTA in place of input.
- [x] Apps panel: 3-column plugin grid driven by live plugin registry, with per-plugin color theming.
- [x] Apps panel: sort modes (recent, alphabetical, most-used) persisted in `localStorage`.
- [x] Apps panel: recent-use and most-used tracking persisted in `localStorage`.
- [x] Sidebar (chat mode): `#general` channel rendered for both signed-in and unsigned users, linking to `/apps/chyme`.
- [x] Sidebar (apps mode): flat searchable plugin list with active-state highlight.
- [x] Right rail: auth-provider username/display name rendered (no hardcoded names).
- [x] Right rail: GDP stats rendered from live data, zero/absent when no published GDP.
- [x] Right rail: top implemented plugin list.
- [x] Right rail: sign-in / create-account CTAs for unsigned visitors.
- [x] Modularity: shell components split per rule 116 (≤ 200 lines per primary function/file).
- [x] No hardcoded stat values — all stats sourced from live data or rendered as zero/absent.

## Open Work (canonical list lives in the inventory's "Risks and Known Technical Debt")

### Hub-Owned Schema

- [ ] Add `hub_channels` table to `ctf/schema.sql` (slug PK, display_name, plugin_route, visibility_scope, ordering).
- [ ] Add `hub_bots` table to `ctf/schema.sql` (slug PK, display_name, avatar_url, persona_blurb, is_active).
- [ ] Add `hub_bot_routes` table to `ctf/schema.sql` (id PK, bot_slug FK, intent_pattern, response_template, plugin_handoff_slug nullable).
- [ ] Add `hub_dm_threads` table to `ctf/schema.sql` (id PK, user_id, counterpart_id_or_bot_slug, last_message_at, unread_count).
- [ ] Each new table follows `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` pattern.

### Hub-Owned API Routes

- [ ] `GET /api/hub/channels` — returns the channel set visible to caller (single `#general` for unauthenticated; multiple for authenticated).
- [ ] `GET /api/hub/dms` — returns DM list for caller, including bot DMs.
- [ ] `GET /api/hub/bots` — returns active bot registry (slug, display name, avatar, persona blurb).
- [ ] `POST /api/survivor-hub-chat/stream` — issues GetStream credentials for the mobile Hub chat surface.

### @Comic Bot

- [ ] Author canonical `@comic` bot profile (display name, avatar, persona blurb) and add to `hub_bots` seed.
- [ ] Author routing rules in `hub_bot_routes` (intent patterns → response templates / plugin handoffs).
- [ ] Wire `@comic` into the DM list via `/api/hub/dms`.
- [ ] Render `@comic` avatar in the chat panel for hub-routed messages.
- [ ] Ensure bot identity is visually distinguishable from human Hub-team responses.

### Sidebar — Channels (multi-channel)

- [ ] Replace `STATIC_CHANNELS` in `shell-sidebar.tsx` with data fetched from `GET /api/hub/channels`.
- [ ] Respect `visibility_scope` so unauthenticated callers receive only `#general`.
- [ ] Surface unread/presence indicators from the Chyme/GetStream backbone when available.

### Sidebar — DMs (interactive)

- [ ] Replace `STATIC_DMS` in `shell-sidebar.tsx` with data fetched from `GET /api/hub/dms`.
- [ ] Build the DM thread view inside the main content panel.
- [ ] Remove `aria-disabled="true"`, the "Soon" badge, and the "Direct messages are not yet wired" placeholder copy once the feature lands.

### Routing Matrix (data-driven)

- [ ] Replace the hardcoded `getActionForText` matrix in `use-home-chat.ts` with a server-side lookup against `hub_bot_routes`.
- [ ] Cache the routing matrix on the client per session; refresh on channel switch.

### Mobile Hub

- [ ] Wire `SurvivorHubChat` into the mobile navigation surface.
- [ ] Confirm `fetchSurvivorHubChatStreamCredentials` lines up with the new `POST /api/survivor-hub-chat/stream` payload.
- [ ] Delete or repurpose `MockSurvivorHubChat.tsx` (Storybook fixture vs. removal).
- [ ] Reach feature parity with the web Hub: chat panel with routing assistant, channels list, DMs/bots, plugin grid.
- [ ] Add a `hub` entry to `ctf/config/plugin-parity-contracts.json`.

### Plugin Catalog / Registry

- [ ] Decide whether Hub is a plugin or an app-shell-level capability, and reflect that choice consistently in:
  - `ctf/packages/web/lib/plugins/plugin-catalog.ts`
  - `ctf/packages/web/lib/plugins/repository.ts`
  - the database plugin registry seed.

### Contracts

- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_COMMAND_CONTRACTS.yaml` covering `/api/hub/*` and `/api/survivor-hub-chat/stream` commands.
- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml` with role requirements and unauthenticated visibility rules.
- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_AUDIT_CONTRACTS.yaml` for bot/DM/channel events worth auditing.
- [ ] Author `ctf/docs/contracts/HUB_PROFILE_AND_DELETION_CONTRACT.md` if Hub introduces user-scoped state (DM threads, recent counters) that must be deletable.

### Seed Coverage

- [ ] Add `ctf/scripts/seedHubPhase0.mjs` (or `seedHub.mjs` — keep naming consistent with peers) that deterministically seeds `hub_channels`, `hub_bots` (including `@comic`), `hub_bot_routes`.

---

## Pre-Release Gates

- [ ] Visual QA against the canonical Survivor Hub desktop mockup in `design/`.
- [ ] Mobile responsive layout checked at 900px and 1200px breakpoints.
- [ ] GDP stats display zero/absent (not hardcoded) when no published GDP data exists.
- [ ] Right rail shows provider-backed first name or username, not placeholder "Survivor" hardcoded text when user is signed in.
- [ ] Auth-provider account control renders in icon rail for signed-in users.
- [ ] No TypeScript errors in `community-shell` component tree.
- [ ] ESLint passes with zero warnings (`pnpm lint`).
- [ ] Plugin card "Open plugin →" links navigate to correct `/apps/[slug]` routes.
- [ ] Channel links navigate to the correct plugin routes.
- [ ] Unauthenticated users see exactly one channel (`#general`) and no DMs / bots / sign-in-gated CTAs.

---

## Change Log

- 2026-05-12: Checklist flattened — phased rollout sections removed per project policy. Items reorganized into "Delivered" vs. "Open Work" so each line item maps directly to the inventory's "Risks and Known Technical Debt" entries.
- 2026-03-23: Initial checklist created under prior phase-based template.
