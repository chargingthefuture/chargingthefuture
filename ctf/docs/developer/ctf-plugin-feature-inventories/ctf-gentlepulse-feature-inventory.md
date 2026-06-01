# GentlePulse Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Unified plugin scope slug: `gentlepulse`
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

1. Plugin route for meditation library (`/apps/gentlepulse`).
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

1. Support/About route (`/apps/gentlepulse/support`).
2. Trauma-informed plugin description.
3. Privacy statement aligned to current CTF policy language.

## 2) Admin Features

### 2.1 In-App Admin Surface

1. No in-app GentlePulse admin UI in CTF scope.
2. No plugin-admin web/mobile route parity is required for GentlePulse in this rewrite.
3. Operational CRUD management is externalized and out of CTF code implementation scope.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface

1. `gentlepulse.library.list`
2. `gentlepulse.meditation.detail.fetch`
3. `gentlepulse.meditation.play.record`
4. `gentlepulse.rating.upsert`
5. `gentlepulse.rating.summary.fetch`
6. `gentlepulse.favorite.add`
7. `gentlepulse.favorite.remove`
8. `gentlepulse.favorite.list`
9. `gentlepulse.favorite.status.fetch`

### 3.2 HTTP Projection Routes

User routes (authenticated):

- `GET /api/gentlepulse/meditations`
- `GET /api/gentlepulse/meditations/:id`
- `POST /api/gentlepulse/meditations/:id/play`
- `POST /api/gentlepulse/ratings`
- `GET /api/gentlepulse/meditations/:id/ratings`
- `POST /api/gentlepulse/favorites`
- `DELETE /api/gentlepulse/favorites/:meditationId`
- `GET /api/gentlepulse/favorites`
- `GET /api/gentlepulse/favorites/check`

Excluded route groups:

1. No `/api/gentlepulse/admin/*` routes in CTF rewrite scope.
2. No plugin-scoped announcements routes in CTF rewrite scope.
3. No `/api/gentlepulse/progress*` routes in CTF rewrite scope.

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

## 5) Security, Privacy, and Compliance Controls

1. Auth required for all GentlePulse API routes.
2. Server-side authz and validation on every mutation.
3. Data minimization for logs and diagnostics.
4. No plugin-local settings persistence logic in GentlePulse; app-level settings contract is reused.

## 6) Web and Android Delivery Status

`web+android complete`. Core library/filter/sort/favorite/rating/play behaviors are consistent across web (`/apps/gentlepulse`) and Android (`packages/mobile/src/features/gentlepulse`). App-level settings parity is tracked in the non-plugin inventory.

Web pixel pass (design `c5d83c0`): the `/apps/gentlepulse` shell matches `design/.../survivor-hub/GentlePulse.tsx` (sessions grid, player, supportive chat, sidebar categories, right panel) with the mockup's 💚 header glyphs; Loading/Empty states added. Library browse, play tracking, and favorite toggles bind to the real `/api/gentlepulse/library*` routes; sessions, categories, and counts derive from that data (no dummy session list). The previously oversized shell was decomposed into modular sub-components (`gp-shared`, `gp-loading`, `gp-icon-rail`, `gp-sidebar`, `gp-sessions`, `gp-player`, `gp-chat`, `gp-right-panel`) within the rule-116 limits, and a dead duplicate `components/gentle-pulse/` directory was removed.

Android pixel pass (2026-05-31): `ctf/packages/mobile/src/features/gentlepulse/` rebuilt against `design/.../survivor-hub/MobileGentlePulse.tsx` (+ Empty/Loading/Public variants). Real screen `GentlePulse.tsx` replaces retired `MockGentlepulse.tsx`. `index.ts` now exports `{ GentlePulse }` from the real screen. `api.ts` updated to export typed `GentlePulseSession` interface and active `recordPlay`, `addFavorite`, `removeFavorite` functions with `x-ctf-csrf: 1` headers. Bound fields: `id`, `title`, `description` from `GET /api/gentlepulse/library`. Omitted (no backing DB column): `emoji`, `duration`, `category`, play-count, streak. Loading/Empty/Public/Main states all implemented with design-faithful colors, spacing, and RN primitives.

## 7) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 8) Gaps and Known Technical Debt

1. Legacy anonymous `clientId` playback history is not migrated into the authenticated user model; legacy listening data does not surface under the user's account.
2. Media playback provider telemetry currently flows through generic platform analytics rather than a dedicated plugin telemetry contract.

## 9) Change Log

- 2026-05-31: Android pixel pass. Rebuilt `GentlePulse.tsx` real screen from `MobileGentlePulse.tsx` design + Empty/Loading/Public variants. Retired `MockGentlepulse.tsx`. Updated `api.ts` with typed interface and active mutation helpers (`recordPlay`, `addFavorite`, `removeFavorite`) with CSRF headers. Bound to real fields: `id`, `title`, `description`. Omitted non-backed fields: `emoji`, `duration`, `category`, play-count, streak.
- 2026-05-29: Web UI circle-back (design `c5d83c0`). Aligned the gentlepulse shell to the `GentlePulse.tsx` mockup + Loading/Empty states; restored the 💚 header glyphs; decomposed the oversized shell into modular sub-components within rule-116 limits; removed the dead duplicate `components/gentle-pulse/` directory. Real `/api/gentlepulse/library*` wiring unchanged.
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
    - Rewrite artifacts use plugin slug `gentlepulse` in CTF folder naming.
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
    - No `/apps/gentlepulse/admin*` implementation tasks are required in this checklist.
- [ ] Confirm progress endpoint exclusion.
  - Acceptance criteria:
    - No `/api/gentlepulse/progress*` contract or implementation tasks are in scope.

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
