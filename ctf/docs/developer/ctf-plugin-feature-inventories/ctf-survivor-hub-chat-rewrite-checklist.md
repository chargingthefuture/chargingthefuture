# Survivor Hub Rewrite Checklist

## Scope

- Rewrite target: `ctf/packages/web`, `ctf/packages/mobile`, `ctf/schema.sql`, `ctf/docs/contracts`.
- Surface: Survivor Hub home experience (`community-shell` + supporting APIs and schema).
- Canonical spec: `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-survivor-hub-chat-feature-inventory.md`.
- Hub has no cross-plugin runtime dependency. See [112-platform-architecture-rules.mdc](../../../../.github/instructions/112-platform-architecture-rules.mdc).
- 100% web↔Android parity is the baseline. See [105-web-android-feature-parity-rules.mdc](../../../../.github/instructions/105-web-android-feature-parity-rules.mdc). No phased rollouts.

This checklist tracks the work needed to bring code into alignment with the inventory. The inventory is the spec; this file is the punch list.

---

## Punch List

### Remove Cross-Plugin Dependency on Chyme (top priority)

- [ ] Replace `lib/chyme/types` imports in `ctf/packages/web/components/community-shell/use-home-chat.ts` with Hub-owned types under `ctf/packages/web/lib/hub/types.ts`.
- [ ] Replace `GET /api/chyme/messages` / `POST /api/chyme/messages` / `POST /api/chyme/join` calls with `/api/hub/messages` and `/api/hub/join`.
- [ ] Replace the `#general` channel's `href` (currently `/apps/chyme`) with the canonical Hub channel route once channel data is loaded from `/api/hub/channels`.
- [ ] Audit the rest of `community-shell/` and `app/apps/` for any remaining Chyme imports, types, fetches, or styling assumptions.

### Hub-Owned Schema

- [ ] Add `hub_channels` to `ctf/schema.sql`.
- [ ] Add `hub_bots` to `ctf/schema.sql`.
- [ ] Add `hub_bot_routes` to `ctf/schema.sql`.
- [ ] Add `hub_dm_threads` to `ctf/schema.sql`.
- [ ] Add `hub_messages` to `ctf/schema.sql`.
- [ ] Each new table follows `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`.

### Hub-Owned GetStream Scope

- [ ] Add Hub-owned GetStream adapter under `ctf/packages/shared` (separate user-id prefix and channel-id namespace from any other plugin).
- [ ] Wire `POST /api/hub/join` and `POST /api/survivor-hub-chat/stream` to issue tokens against Hub's GetStream scope only.

### Hub-Owned API Routes

- [ ] `GET /api/hub/channels`.
- [ ] `GET /api/hub/dms`.
- [ ] `GET /api/hub/bots`.
- [ ] `GET /api/hub/messages`.
- [ ] `POST /api/hub/messages`.
- [ ] `POST /api/hub/join`.
- [ ] `POST /api/survivor-hub-chat/stream` (alias delegating to `POST /api/hub/join`).

### `@comic` Bot

- [ ] Author canonical `@comic` bot profile and add to `hub_bots` seed.
- [ ] Author routing rules in `hub_bot_routes`.
- [ ] Wire `@comic` into the DM list via `/api/hub/dms`.
- [ ] Render `@comic` avatar in the chat panel for bot-routed messages.

### Sidebar — Channels

- [ ] Replace `STATIC_CHANNELS` in `shell-sidebar.tsx` with data fetched from `GET /api/hub/channels`.
- [ ] Respect `visibility_scope` so unauthenticated callers receive only `#general`.

### Sidebar — DMs

- [ ] Replace `STATIC_DMS` in `shell-sidebar.tsx` with data fetched from `GET /api/hub/dms`.
- [ ] Build the DM thread view inside the main content panel.
- [ ] Remove the disabled-state markup and tooltip strings once DMs are live.

### Routing Matrix (data-driven)

- [ ] Replace the hardcoded `getActionForText` matrix in `use-home-chat.ts` with a server-side lookup against `hub_bot_routes`.

### Mobile Hub (parity)

- [ ] Wire `SurvivorHubChat` into the mobile navigation surface.
- [ ] Align `fetchSurvivorHubChatStreamCredentials` with `POST /api/survivor-hub-chat/stream`.
- [ ] Delete `MockSurvivorHubChat.tsx` or repurpose it as a Storybook fixture.
- [ ] Reach feature parity with the web Hub: chat panel with routing assistant, channels list, DMs/bots, plugin grid.
- [ ] Add a `hub` entry to `ctf/config/plugin-parity-contracts.json`.

### Plugin Catalog / Registry

- [ ] Add `hub` to `ctf/packages/web/lib/plugins/plugin-catalog.ts`.
- [ ] Add `hub` to the plugin registry seed and `lib/plugins/repository.ts` fallback list.

### Contracts

- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_COMMAND_CONTRACTS.yaml`.
- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`.
- [ ] Author `ctf/docs/contracts/HUB_PLUGIN_AUDIT_CONTRACTS.yaml`.
- [ ] Author `ctf/docs/contracts/HUB_PROFILE_AND_DELETION_CONTRACT.md`.

### Seed Coverage

- [ ] Add `ctf/scripts/seedHubPhase0.mjs` that deterministically seeds `hub_channels`, `hub_bots` (including `@comic`), `hub_bot_routes`.

---

## Pre-Merge Gates

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

## Change Log

- 2026-05-12: Checklist re-scoped as a punch list against the canonical inventory; rules 105, 107, 112, 120 referenced; pre-merge gates assert no cross-plugin imports/fetches; phased-rollout sections removed.
- 2026-03-23: Initial checklist created under prior phase-based template.
