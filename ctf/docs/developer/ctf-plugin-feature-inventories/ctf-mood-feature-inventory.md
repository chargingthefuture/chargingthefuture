# Mood Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Unified plugin scope slug: `mood`
- This document is the living snapshot of Mood per Rule 120.
- Plugin name to retain: `Mood`.

Scope decisions locked for this rewrite:

1. Mood is a standalone plugin and is not embedded in GentlePulse flows.
2. No severe-value safety trigger messaging is in Mood scope.
3. No Mood announcements UI/API scope is included.
4. No Mood in-app admin dashboard/UI scope is included.
5. Mood API posture is authenticated-user-only, with mood records persisted using anonymous `clientId`.

---

## 1) User Features

### 1.1 Mood Check Submission

1. Plugin route for mood check (`/apps/mood`).
2. Authenticated user can submit a mood check via `POST /api/mood/submissions`.
3. Mood scale validation (`1..5`) is enforced.
4. Submission response does not include severe-value safety trigger fields.

### 1.2 Eligibility Window

1. Eligibility endpoint: `GET /api/mood/eligibility?clientId=...`.
2. Cooldown model: one check every 7 days.
3. If no prior record (or parse failure), client is treated as eligible.

## 2) Admin Features

### 2.1 In-App Admin Surface

1. No in-app Mood admin UI in CTF scope.
2. No plugin-admin web/mobile route parity is required for Mood in this rewrite.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface

1. `mood.check.submit`
2. `mood.check.eligibility.fetch`
3. `mood.community.pulse.fetch` (aggregate, anonymous)

### 3.2 HTTP Projection Routes

User routes (authenticated):

- `POST /api/mood/submissions` — submit an anonymous mood check (`{ clientId, moodValue, note }`, `x-ctf-csrf: 1`).
- `GET /api/mood/eligibility?clientId=` — per-device cooldown gate.
- `GET /api/mood/community` — aggregate, anonymous community pulse. Returns only per-day average mood + counts over the trailing 7 days plus a window total and average; never any per-user rows, notes, or identifiers. Withholds data (returns `hasEnoughData: false` with a zeroed series) until at least `MOOD_PULSE_MIN_SAMPLE` (5) check-ins exist in the window.

Excluded route groups:

1. No `/api/mood/announcements*` routes in CTF rewrite scope.
2. No `/api/mood/admin*` routes in CTF rewrite scope.

## 4) Data Model and Storage Contracts

### 4.1 Mood Checks

1. Mood checks store `clientId`, `moodValue`, and check timestamp metadata in `mood_submissions` (`id`, `user_id`, `client_id`, `mood_value`, `note`, `submitted_at`).
2. Mood values are validated as integer range `1..5`.
3. Eligibility evaluation is derived from last check timestamp per `clientId`.

### 4.2 Community Pulse (aggregate-only, no new storage)

1. The community pulse is computed on read from the existing `mood_submissions` table — no new table or column is added.
2. The aggregation query reads only `mood_value` and `submitted_at`, grouped by calendar day over the trailing 7 days. It never selects `user_id`, `client_id`, or `note`, so no result can be tied to a person.
3. A minimum-sample threshold (`MOOD_PULSE_MIN_SAMPLE` = 5 check-ins in the window) gates display; below it the API returns `hasEnoughData: false` and a zeroed day series.

## 5) Security, Privacy, and Compliance Controls

1. Auth required for all Mood API routes.
2. Server-side validation on every submission and eligibility request.
3. Logs/diagnostics enforce data minimization and avoid unnecessary request metadata.
4. Anonymous persistence contract is maintained by storing mood values under `clientId` instead of `user_id`.

## 6) Web and Android Delivery Status

**Web:** ✅ delivered (design `c5d83c0`, 2026-05-29)
**Android:** ✅ delivered (design `MobileMood.tsx`, 2026-05-31)

Parity points met:
1. Mood check route/entry, eligibility behavior, and submission outcomes match between web and Android.
2. Cooldown and validation semantics match between web and Android (7-day window, 1–5 scale).
3. No Mood admin parity obligations in web/mobile for this rewrite scope.

Web pixel pass (design `c5d83c0`): the `/apps/mood` shell is rebuilt to `design/.../survivor-hub/Mood.tsx` and its Empty/Loading states. The anonymous check-in flow is wired to the real API — `GET /api/mood/eligibility?clientId=` gates the form (per-device `clientId` persisted in localStorage), and `POST /api/mood/submissions` sends `{ clientId, moodValue, note }` with the `x-ctf-csrf` header. This fixes the prior shell, which called eligibility with no `clientId` and POSTed the wrong field names (both 400'd at runtime). The Community Pulse tab now renders a real aggregate (2026-06-07): `GET /api/mood/community` returns an anonymous 7-day average-mood chart plus check-in counts computed from the existing `mood_submissions` table, with loading/empty/error states and a minimum-sample gate so small samples are withheld. Decomposed into modular sub-components within the rule-116 limits; banned "Phase 2" wording removed.

Android pixel pass (design `MobileMood.tsx`, 2026-05-31): built `ctf/packages/mobile/src/features/mood/Mood.tsx` + `api.ts`; retired `MockMood.tsx`. The screen faithfully translates the `MobileMood.tsx` mockup into React Native primitives — dark-mode only (`#0F1117` background), pink `#EC4899` accent, five-mood emoji picker, optional anonymous note, eligibility gate from `GET /api/mood/eligibility?clientId=`, submission via `POST /api/mood/submissions` with `{ clientId, moodValue, note }` + `x-ctf-csrf: 1` header, cooldown display. The Trends tab now renders the real aggregate community pulse (2026-06-07) from `GET /api/mood/community` — a 7-day average-mood chart plus counts, with loading/empty/error states. Home and Private tabs are pure UI and retained. TypeScript, EOF, and parity gates all pass.

## 7) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 8) Gaps and Known Technical Debt

1. Anonymous `clientId` persistence behind authenticated routes is governed by an implicit policy; explicit user-facing wording on anonymity expectations is a known follow-up.
2. Multi-device behavior (multiple `clientId`s for one authenticated user) is allowed by current schema; no UI affordance to reconcile or merge mood history across devices.

## 9) Change Log

- 2026-06-07: Community Pulse delivered for real (web + Android). Added `getMoodCommunityPulse` to `lib/mood/repository.ts` and `GET /api/mood/community`, computing an aggregate, anonymous 7-day average-mood chart + counts from the existing `mood_submissions` table (no schema change). Reads only `mood_value` + `submitted_at`; withholds data until 5 check-ins exist in the window. Web `mood-community.tsx` and mobile `Mood.tsx` Trends tab now render the real chart with loading/empty/error states; the previous "coming soon" stub and the omitted mobile chart are replaced. No schema change.
- 2026-05-31: Android pixel pass. Built `Mood.tsx` + `api.ts` in `ctf/packages/mobile/src/features/mood/`; retired `MockMood.tsx`. Real bindings to `GET /api/mood/eligibility` and `POST /api/mood/submissions`. Omitted Trends tab chart and community-avg card (no aggregate-stats API). TypeScript, EOF, and parity gates pass. Android delivery status: ✅.
- 2026-05-29: Web UI circle-back (design `c5d83c0`). Rebuilt the mood shell to the `Mood.tsx` mockup + Empty/Loading; fixed the eligibility (`?clientId=`) and submission (`{ clientId, moodValue, note }` + CSRF header) API contracts that previously 400'd; replaced fabricated trend/distribution data with the design's honest Community Pulse empty state; decomposed into modular sub-components within the rule-116 limits; removed banned "Phase 2" wording. No schema/API change.
- 2026-05-18: Renamed "Gaps, Ambiguities, and Known Debt (Planning)" to canonical "Gaps and Known Technical Debt" per Rule 120.
- 2026-02-25: Created initial Mood CTF rewrite inventory.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [ ] Confirm plugin identity and naming.
  - Acceptance criteria:
    - Rewrite artifacts use plugin slug `mood` in CTF folder naming.
- [ ] Confirm locked Mood scope exclusions.
  - Acceptance criteria:
    - No severe-value safety trigger logic/messages are included.
    - No Mood announcements route/API/UI scope is included.
    - No Mood in-app admin route/API/UI scope is included.
- [ ] Confirm plugin boundary separation from GentlePulse.
  - Acceptance criteria:
    - Mood user flows are standalone and not embedded in GentlePulse features.

### �� Contracts and Scope Lock

- [ ] Lock authenticated API posture for Mood routes.
  - Acceptance criteria:
    - Auth requirements are explicit for all Mood endpoints.
- [ ] Lock retained user feature set.
  - Acceptance criteria:
    - Mood check submit and 7-day eligibility are listed as in-scope.
- [ ] Lock identity and persistence contract.
  - Acceptance criteria:
    - Submission access is authenticated-user-only.
    - Mood values are persisted by anonymous `clientId` (not `user_id`).

### �� Data and Migration Readiness

- [ ] Define mood-check schema and uniqueness constraints.
  - Acceptance criteria:
    - Required mood-check fields and validation ranges are documented.
    - Eligibility computation basis (latest check by `clientId`) is deterministic.
- [ ] Define multi-device behavior policy.
  - Acceptance criteria:
    - Product decision for multiple `clientId`s per authenticated user is documented.

### �� API and Behavior Implementation Readiness

- [ ] Finalize API route map for in-scope features.
  - Acceptance criteria:
    - `POST /api/mood/submissions` and `GET /api/mood/eligibility` are documented and versioned.
- [ ] Finalize command contract map.
  - Acceptance criteria:
    - `mood.check.submit` and `mood.check.eligibility.fetch` are represented in command-contract artifacts.
- [ ] Add regression guard for excluded scopes.
  - Acceptance criteria:
    - Validation gate or lint/contract checks fail if announcements/admin/safety-trigger surface is introduced.

### �� Security and Compliance Gates

- [ ] Verify authz coverage for all Mood writes/reads.
  - Acceptance criteria:
    - Mood routes reject unauthenticated access.
- [ ] Verify data minimization and privacy controls.
  - Acceptance criteria:
    - Logs and diagnostics exclude unnecessary sensitive request metadata.
- [ ] Verify policy language for anonymity model.
  - Acceptance criteria:
    - Product/policy wording is consistent with authenticated access plus anonymous `clientId` storage.

### �� Web and Android Parity Gates

- [ ] Validate web/mobile parity for core Mood journey.
  - Acceptance criteria:
    - Check eligibility → submit mood flow is equivalent across web and Android.
- [ ] Validate cooldown and validation parity.
  - Acceptance criteria:
    - 7-day gating and `1..5` validation outcomes match across clients.
- [ ] Validate excluded-scope parity posture.
  - Acceptance criteria:
    - No Mood admin or announcements parity tasks are required because these are out of scope.

### �� Validation, Seeds, and Release Evidence [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] API/integration design documentation for retained feature scope.
  - Acceptance criteria:
    - Submit and eligibility behaviors are documented, including cooldown edges.
- [ ] Deterministic seed fixtures for retained domain entities.
  - Acceptance criteria:
    - Mood-check fixtures are deterministic and data-compatible.
- [ ] Scope evidence documentation. [EVIDENCE COLLECTION DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - CTF inventory + checklist are updated in same PR as feature-scope changes.

### Change Log

- 2026-05-31: Seed runtime fix. `seedMood.mjs` now opens its own `pg` Pool and defines a local `withDbTransaction` helper instead of importing the TypeScript `packages/web/lib/db/postgres.ts`, which plain Node (e.g. the Node 20 seed/provision workflows) cannot load. Added `pool.end()` teardown. No change to seeded rows, schema, or API.
- 2026-02-25: Created initial Mood CTF rewrite checklist with locked scope exclusions (no severe-value safety trigger, no announcements, no in-app admin) and standalone-plugin boundary plus authenticated-route baseline using anonymous `clientId` persistence.
