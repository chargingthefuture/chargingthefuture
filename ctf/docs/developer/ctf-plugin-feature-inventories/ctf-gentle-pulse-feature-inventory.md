# GentlePulse Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Unified plugin scope slug: `gentle-pulse`
- This document is the living snapshot of GentlePulse per Rule 120.
- Plugin name to retain: `GentlePulse`.

Scope decisions locked for this rewrite:

1. `Settings and Personalization` is moved to app-level non-plugin ownership.
2. GentlePulse has no in-app admin page in CTF.
3. GentlePulse plugin announcements are removed from plugin scope and owned by app-wide Announcements/Feed surfaces.
4. GentlePulse API posture is authenticated-user-only.
5. Dedicated progress endpoints are out of scope; legacy references are treated as stub/scaffold mismatch.

Authoritative app-level ownership reference:

- `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-non-plugin-feature-inventory.md`

---

## 1) User Features

### 1.1 Library Dashboard

1. Plugin route for meditation library (`/apps/gentle-pulse`).
2. Meditation listing with pagination (`limit`, `offset`).
3. Sort modes: `newest`, `most-rated`, `highest-rating`.
4. Tag-based filtering.
5. Favorites-only mode with deterministic loading/empty/error states.

### 1.2 Meditation Card Interactions

1. Display title, description, tags, duration, average rating, and rating count.
2. Play action increments server play count and opens meditation media URL.
3. Authenticated star rating submission (1–5) with aggregate refresh.
4. Authenticated favorite add/remove interactions with cache refresh and user feedback.

### 1.3 Support Page

1. Support/About route (`/apps/gentle-pulse/support`).
2. Trauma-informed plugin description.
3. Privacy statement aligned to current CTF policy language.

## 2) Admin Features

### 2.1 In-App Admin Surface

1. No in-app GentlePulse admin UI in CTF scope.
2. No plugin-admin web/mobile route parity is required for GentlePulse in this rewrite.
3. Operational CRUD management is externalized and out of CTF code implementation scope.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface

1. `gentle-pulse.library.list`
2. `gentle-pulse.meditation.detail.fetch`
3. `gentle-pulse.meditation.play.record`
4. `gentle-pulse.rating.upsert`
5. `gentle-pulse.rating.summary.fetch`
6. `gentle-pulse.favorite.add`
7. `gentle-pulse.favorite.remove`
8. `gentle-pulse.favorite.list`
9. `gentle-pulse.favorite.status.fetch`

### 3.2 HTTP Projection Routes

User routes (authenticated) — verified against the route handlers (2026-06-25). The implemented routes use the `library/[itemId]` shape; the earlier `/api/gentle-pulse/meditations*`, `/ratings`, and `/favorites*` names previously listed here did not match any handler in the code and have been replaced:

- `GET /api/gentle-pulse/library` — list the active library items. Reads contract query params `sort` (`newest`/`oldest`/`title`), `favoritesOnly` (`true` filters to the caller's favorites), `limit` (max 100), and `offset` for pagination. Returns `{ ok, items, total }` where `total` is the unpaginated count.
- `GET /api/gentle-pulse/library/[itemId]` — fetch one library item by id (`getLibraryItemById`); 404 when not found. Read-gated (`requireGentlePulseReadAccess`).
- `POST` / `DELETE /api/gentle-pulse/library/[itemId]/favorite` — add / remove the caller's favorite for an item (`setFavorite`, `favorited` true/false). Write-gated (`requireGentlePulseWriteAccess`), CSRF-guarded.
- `POST /api/gentle-pulse/library/[itemId]/play` — record a play event (`trackPlayEvent`); body `{ anonymousClientId?, completed? }`; returns 201 with `{ ok, meditationId, playCount, mediaUrl }` per the command contract. Write-gated, CSRF-guarded — an anonymous client id is accepted so unattributed plays are still counted.
- `PUT /api/gentle-pulse/library/[itemId]/rating` — upsert the caller's rating (`upsertRating`); body `{ rating: number }` (400 when missing or non-numeric). Returns `{ ok, meditationId, averageRating, ratingCount }` with the refreshed aggregate per the command contract. Write-gated, CSRF-guarded.

All three commands (`gentle-pulse.library.list`, `gentle-pulse.meditation.play.record`, `gentle-pulse.rating.upsert`) emit a structured audit line via `lib/gentle-pulse/audit.ts` (`logGentlePulseAudit`) on both the allow and deny paths, matching `GENTLE_PULSE_PLUGIN_AUDIT_CONTRACTS.yaml`.
- `GET /api/gentle-pulse/support` — returns a static support pointer (`{ supportRoute: '/support', note }`); GentlePulse delegates support to app-level support ownership. Read-gated.

Excluded route groups:

1. No `/api/gentle-pulse/admin/*` routes in CTF rewrite scope.
2. No plugin-scoped announcements routes in CTF rewrite scope.
3. No `/api/gentle-pulse/progress*` routes in CTF rewrite scope.

## 4) Data Model and Storage Contracts

### 4.1 Meditations

1. Meditations store title, description, media URL, thumbnail, duration, tags, position, active state.
2. Aggregate fields retained: `playCount`, `averageRating`, `ratingCount`.

### 4.2 Ratings

1. Ratings keyed per user + meditation in authenticated model.
2. Rating writes validate integer range `1..5`.
3. Aggregate rating/count recomputed after mutation.

### 4.3 Favorites

1. Favorites keyed per user + meditation.
2. Favorite add/remove/list/status endpoints support deterministic interface-state hydration.

### 4.4 Implemented storage tables

The shipped schema is leaner than the intended model in §4.1–§4.3: the thumbnail / duration / tags / position fields and the denormalized `playCount` / `averageRating` / `ratingCount` aggregates described there are not columns on these tables (they would be computed). The actual tables in `ctf/schema.sql`:

- `gentle_pulse_library_items` — the meditation catalog. Columns: `id`, `slug` (unique), `title`, `description`, `media_url`, `support_route`, `is_active`, `created_at`, `updated_at`.
- `gentle_pulse_ratings` — per-user rating, PK `(user_id, item_id)`. Columns: `user_id`, `item_id`, `rating` (integer), `created_at`, `updated_at`. Upserted by `PUT …/rating`.
- `gentle_pulse_favorites` — per-user favorite. Columns: `id`, `user_id`, `item_id`, `created_at`, with `UNIQUE (user_id, item_id)`. Toggled by `POST` / `DELETE …/favorite`.
- `gentle_pulse_play_events` — append-only play log. Columns: `id`, `user_id` (nullable), `anonymous_client_id` (nullable), `item_id`, `completed`, `created_at`. Written by `POST …/play`; the nullable user / anonymous-id pair lets both signed-in and anonymous plays be recorded.

## 5) Security, Privacy, and Compliance Controls

1. Auth required for all GentlePulse API routes.
2. Server-side authz and validation on every mutation.
3. Data minimization for logs and diagnostics.
4. No plugin-local settings persistence logic in GentlePulse; app-level settings contract is reused.

## 6) Web and Android Delivery Status

Delivery: **web + mobile-responsive complete**. **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). Historical parity detail: core library/filter/sort/favorite/rating/play behaviors were consistent across web (`/apps/gentle-pulse`) and the former Android surface (`packages/mobile/src/features/gentle-pulse`, now removed). App-level settings parity is tracked in the non-plugin inventory.

Web pixel pass (design `c5d83c0`): the `/apps/gentle-pulse` shell matches `design/.../survivor-hub/GentlePulse.tsx` (sessions grid, player, supportive chat, sidebar categories, right panel) with the mockup's 💚 header glyphs; Loading/Empty states added. Library browse, play tracking, and favorite toggles bind to the real `/api/gentle-pulse/library*` routes; sessions, categories, and counts derive from that data (no dummy session list). The previously oversized shell was decomposed into modular sub-components (`gp-shared`, `gp-loading`, `gp-icon-rail`, `gp-sidebar`, `gp-sessions`, `gp-player`, `gp-chat`, `gp-right-panel`) within the rule-116 limits, and a dead duplicate `components/gentle-pulse/` directory was removed.

Android pixel pass (2026-05-31): `ctf/packages/mobile/src/features/gentle-pulse/` rebuilt against `design/.../survivor-hub/MobileGentlePulse.tsx` (+ Empty/Loading/Public variants). Real screen `GentlePulse.tsx` replaces retired `MockGentlePulse.tsx`. `index.ts` now exports `{ GentlePulse }` from the real screen. `api.ts` updated to export typed `GentlePulseSession` interface and active `recordPlay`, `addFavorite`, `removeFavorite` functions with `x-ctf-csrf: 1` headers. Bound fields: `id`, `title`, `description` from `GET /api/gentle-pulse/library`. Omitted (no backing DB column): `emoji`, `duration`, `category`, play-count, streak. Loading/Empty/Public/Main states all implemented with design-faithful colors, spacing, and RN primitives.

## 7) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 8) Gaps and Known Technical Debt

1. Legacy anonymous `clientId` playback history is not migrated into the authenticated user model; legacy listening data does not surface under the user's account.
2. Media playback provider telemetry currently flows through generic platform analytics rather than a dedicated plugin telemetry contract.

## 9) Change Log

- 2026-07-17: **History-aware back navigation (app-wide sweep).** The member shell's hand-rolled
  back chevron was replaced by the shared `BackChevronButton` — it returns to the previous in-app
  page and falls back to All Apps when there is no in-app history. UI-only; no schema, route, or
  contract change.
- 2026-07-14: **Added refresh controls (app-wide refresh rollout, web only).** Web: shared `RefreshButton` in the desktop and mobile-responsive shell headers (`gentle-pulse-shell.tsx`); the library fetch was extracted from the mount effect into a `fetchLibrary` useCallback shared by the effect and the button, so a refresh re-pulls the session library without flashing the full-screen loading state. Android untouched — the `GentlePulse` screen already ships native pull-to-refresh. UI-only; no schema, route, or contract change.
- 2026-06-27: **Resolved the gentle-pulse code-review sweep findings (#1050–#1057).** Web shell now reads `data.items` (not `data.sessions`) and derives categories client-side, and its play/favorite `fetch` calls send the `x-ctf-csrf: 1` header the routes require — without it every web play/favorite was denied 403 and swallowed. The library list route reads the contract query params (`sort`, `favoritesOnly`, `limit`, `offset`) and returns `{ ok, items, total }`; the play route returns `{ meditationId, playCount, mediaUrl }` and the rating route returns `{ meditationId, averageRating, ratingCount }`, matching the command contract output schemas. Added `lib/gentle-pulse/audit.ts` (`logGentlePulseAudit`) and emit one structured audit line per command on allow and deny, matching the audit contract. Deleted the dead duplicate `app/api/gentle-pulse/_lib.ts` — all routes already import from `lib/gentle-pulse/_lib`. No schema or contract-file changes; the database tables and contract YAML are unchanged.
- 2026-06-26: **Renamed the plugin `gentlepulse` → `gentle-pulse` (hard cutover, no backward-compatible aliases).** The slug, route folders, command names, contract-file prefixes, and inventory filename are now the hyphenated/kebab form: slug `gentle-pulse`, routes `/api/gentle-pulse/*` and `/apps/gentle-pulse`, commands `gentle-pulse.*`, contracts `GENTLE_PULSE_*`. The four database tables were renamed to snake_case — `gentlepulse_library_items` → `gentle_pulse_library_items`, `gentlepulse_play_events` → `gentle_pulse_play_events`, `gentlepulse_ratings` → `gentle_pulse_ratings`, `gentlepulse_favorites` → `gentle_pulse_favorites` — with `ALTER TABLE … RENAME TO` run before each `CREATE TABLE IF NOT EXISTS` in `schema.sql` and `schema.demo.sql` so an existing database keeps its data and a fresh one is unaffected. The plugin-registry seed row's slug is now `gentle-pulse` (display name `GentlePulse` unchanged) and a `DELETE FROM ctf_plugin_registry WHERE plugin_slug IN ('gentlepulse')` was added before the seed so existing databases drop the orphaned old-slug row and the Apps list no longer shows the plugin twice. PascalCase `GentlePulse` proper-noun identifiers and the display name are unchanged; the client-facing error-code string values moved to `gentle_pulse_*` (e.g. `gentle_pulse_csrf_denied`). No Stream surfaces touched, so no quota note. No `gentlepulse → gentle-pulse` alias was added.
- 2026-06-25: **Documented the implemented routes and storage tables, correcting drift** (inventory-debt burn-down). §3.2's user-route list was replaced with the routes that actually ship (`GET /api/gentle-pulse/library`, `GET /api/gentle-pulse/library/[itemId]`, `POST`/`DELETE …/favorite`, `POST …/play`, `PUT …/rating`, `GET /api/gentle-pulse/support`) — the previously-listed `/meditations*`, `/ratings`, and `/favorites*` names matched no handler. Added §4.4 with the four real tables (`gentle_pulse_library_items`, `gentle_pulse_ratings`, `gentle_pulse_favorites`, `gentle_pulse_play_events`) and their columns, noting the shipped schema is leaner than the aggregate model in §4.1–§4.3. Each verified against the handlers and `schema.sql`. Removed these four tables and five routes from the inventory-drift allowlist. Documentation only; no code change.
- 2026-06-12: Android API client (`api.ts`) now calls the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain fetch against an environment-variable base URL with no auth token. No backend, schema, or contract change.
- 2026-05-31: Android pixel pass. Rebuilt `GentlePulse.tsx` real screen from `MobileGentlePulse.tsx` design + Empty/Loading/Public variants. Retired `MockGentlePulse.tsx`. Updated `api.ts` with typed interface and active mutation helpers (`recordPlay`, `addFavorite`, `removeFavorite`) with CSRF headers. Bound to real fields: `id`, `title`, `description`. Omitted non-backed fields: `emoji`, `duration`, `category`, play-count, streak.
- 2026-05-29: Web UI circle-back (design `c5d83c0`). Aligned the gentle-pulse shell to the `GentlePulse.tsx` mockup + Loading/Empty states; restored the 💚 header glyphs; decomposed the oversized shell into modular sub-components within rule-116 limits; removed the dead duplicate `components/gentle-pulse/` directory. Real `/api/gentle-pulse/library*` wiring unchanged.
- 2026-05-18: Renamed "Web and Android Parity Plan" to canonical "Web and Android Delivery Status" and confirmed `web+android complete`. Renamed "Gaps, Ambiguities, and Known Debt (Planning)" to canonical "Gaps and Known Technical Debt" per Rule 120.
- 2026-02-25: Created initial GentlePulse CTF rewrite inventory.
- 2026-02-25: Removed Mood integration from GentlePulse parity scope; GentlePulse and Mood are documented as separate plugins.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [ ] Confirm plugin identity and naming.
  - Acceptance criteria:
    - Rewrite artifacts use plugin slug `gentle-pulse` in CTF folder naming.
- [ ] Confirm app-level ownership transfer for settings/accessibility.
  - Acceptance criteria:
    - GentlePulse plugin does not own `Settings and Accessibility Personalization` in CTF.
    - Ownership reference exists in `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-non-plugin-feature-inventory.md`.
- [ ] Confirm plugin announcements removal from GentlePulse scope.
  - Acceptance criteria:
    - No plugin-specific announcements routes/components are in GentlePulse parity scope.
    - App-wide Announcements/Feed ownership is referenced.
- [ ] Confirm no in-app GentlePulse admin UI.
  - Acceptance criteria:
    - No `/apps/gentle-pulse/admin*` implementation tasks are required in this checklist.
- [ ] Confirm progress endpoint exclusion.
  - Acceptance criteria:
    - No `/api/gentle-pulse/progress*` contract or implementation tasks are in scope.

### �� Contracts and Scope Lock

- [ ] Lock authenticated API posture for GentlePulse routes.
  - Acceptance criteria:
    - Auth requirements are explicit for all GentlePulse endpoints.
- [ ] Lock retained user feature set.
  - Acceptance criteria:
    - Library listing/filtering/sorting, play tracking, ratings, favorites, and support page are listed as in-scope.
- [ ] Lock excluded feature set.
  - Acceptance criteria:
    - Exclusions include plugin settings/accessibility, plugin announcements, in-app admin surfaces, and progress endpoints.

### �� Data and Migration Readiness

- [ ] Define migration approach from anonymous `clientId` to authenticated user model.
  - Acceptance criteria:
    - Backfill/cutover strategy is documented with rollback notes.
- [ ] Define rating/favorite uniqueness and aggregation constraints.
  - Acceptance criteria:
    - Storage constraints prevent duplicate user-meditation records where intended.
    - Aggregate rating derivation behavior is deterministic.
- [ ] Validate meditations schema parity.
  - Acceptance criteria:
    - Required fields and sorting/filtering indexes are documented.

### �� API and Behavior Implementation Readiness

- [ ] Finalize API route map for in-scope features.
  - Acceptance criteria:
    - Meditations/play/ratings/favorites routes are versioned and documented.
- [ ] Add regression guard for excluded scopes.
  - Acceptance criteria:
    - Validation gate or lint/contract checks fail if excluded route groups are introduced.

### �� Security and Compliance Gates

- [ ] Verify authz coverage for all GentlePulse writes.
  - Acceptance criteria:
    - All mutation endpoints enforce authentication and role/policy checks as required.
- [ ] Verify data minimization and privacy controls.
  - Acceptance criteria:
    - Logs and diagnostics exclude unnecessary sensitive request metadata.
- [ ] Verify cross-plugin policy consistency.
  - Acceptance criteria:
    - Exposed GentlePulse contracts align with approved shared deny/error taxonomy.

### �� Web and Android Parity Gates

- [ ] Web/mobile parity design scope for core user journeys.
  - Acceptance criteria:
    - Browse → play → rate → favorite behavior is documented for equivalence.
- [ ] Ownership boundary design for settings/accessibility.
  - Acceptance criteria:
    - GentlePulse clients consume app-level settings contracts.

### �� Validation, Seeds, and Release Evidence [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] API/integration design documentation for retained feature scope.
  - Acceptance criteria:
    - Meditations, play count, ratings, and favorites are documented.
- [ ] Deterministic seed fixtures for retained domain entities.
  - Acceptance criteria:
    - Meditation and interaction fixtures are deterministic and schema-compatible.
- [ ] Scope evidence documentation. [EVIDENCE COLLECTION DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - CTF inventory + checklist are updated in same PR as feature-scope changes.

### Change Log

- 2026-02-25: Created initial GentlePulse CTF rewrite checklist with locked exclusions (plugin settings/accessibility, plugin announcements, in-app admin, progress endpoints) and authenticated-route baseline.
- 2026-02-25: Removed Mood integration tasks from GentlePulse rewrite checklist to preserve plugin separation.
