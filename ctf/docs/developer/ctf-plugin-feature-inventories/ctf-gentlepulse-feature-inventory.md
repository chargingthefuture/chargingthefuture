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

## 7) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 8) Gaps and Known Technical Debt

1. Legacy anonymous `clientId` playback history is not migrated into the authenticated user model; legacy listening data does not surface under the user's account.
2. Media playback provider telemetry currently flows through generic platform analytics rather than a dedicated plugin telemetry contract.

## 9) Change Log

- 2026-05-18: Renamed "Web and Android Parity Plan" to canonical "Web and Android Delivery Status" and confirmed `web+android complete`. Renamed "Gaps, Ambiguities, and Known Debt (Planning)" to canonical "Gaps and Known Technical Debt" per Rule 120.
- 2026-02-25: Created initial GentlePulse CTF rewrite inventory.
- 2026-02-25: Removed Mood integration from GentlePulse parity scope; GentlePulse and Mood are documented as separate plugins.
