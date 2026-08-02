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
2. Cooldown model: one check every 7 days, keyed on the server-controlled pseudonym (resolved from the authenticated user via `mood_client_identities`). `clientId` is still required as input but is not the cooldown key — keying on the client-supplied value let a member bypass the window or probe another device's state, and keying directly on `user_id` tied the check-in to the account; the pseudonym closes both.
3. If no prior record (or parse failure), the user is treated as eligible.
4. The submission response uses the command-contract field names `checkId` and `submittedAt`.

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

- `POST /api/mood/submissions` — submit a pseudonymous mood check (`{ clientId, moodValue, note }`, `x-ctf-csrf: 1`); stored under the user's server-side pseudonym, no `user_id` on the row.
- `GET /api/mood/eligibility?clientId=` — per-user cooldown gate (keyed on the pseudonym).
- `GET /api/mood/community` — aggregate, anonymous community pulse. Returns only per-day average mood + counts over the trailing 7 days plus a window total and average; never any per-user rows, notes, or identifiers. Withholds data (returns `hasEnoughData: false` with a zeroed series) until at least `MOOD_PULSE_MIN_SAMPLE` (5) check-ins exist in the window.

Excluded route groups:

1. No `/api/mood/announcements*` routes in CTF rewrite scope.
2. No `/api/mood/admin*` routes in CTF rewrite scope.

## 4) Data Model and Storage Contracts

### 4.1 Mood Checks (pseudonymous)

1. Mood check-ins are stored **pseudonymously**. Two tables:
   - `mood_client_identities` (`pseudonym` UUID PK, `user_id` TEXT unique, `created_at`) — the only place a check-in is linked to an account. The server creates one stable pseudonym per user on first use.
   - `mood_submissions` (`id`, `user_id`, `client_id`, `mood_value`, `note`, `submitted_at`, `pseudonym`) — the check-ins. Rows are written with `user_id` **empty**; the account link exists only via `pseudonym` → `mood_client_identities`. `mood_submissions.pseudonym` is a FK to `mood_client_identities(pseudonym)` with `ON DELETE CASCADE`.
   - Command contracts for `mood.check.submit` and `mood.check.eligibility.fetch` declare `dataAccess: [mood_submissions, mood_client_identities]`.
2. Mood values are validated as integer range `1..5` at the API boundary (returns `400 mood_invalid_payload`) and again in the repository.
3. Eligibility/cooldown is derived from the last check timestamp for the user's pseudonym (never the raw `user_id` and never the client-supplied `clientId`). The pseudonym is server-controlled and one-per-user, so the cooldown cannot be bypassed.
4. Migration: existing rows were backfilled — a pseudonym created per existing `user_id`, their check-ins repointed to it, then `user_id` blanked on `mood_submissions` so past data is decoupled too (idempotent, in `ctf/schema.sql`).

### 4.2 Community Pulse (aggregate-only, no new storage)

1. The community pulse is computed on read from the existing `mood_submissions` table — no new table or column is added.
2. The aggregation query reads only `mood_value` and `submitted_at`, grouped by calendar day over the trailing 7 days. It never selects `user_id`, `client_id`, or `note`, so no result can be tied to a person.
3. A minimum-sample threshold (`MOOD_PULSE_MIN_SAMPLE` = 5 check-ins in the window) gates display; below it the API returns `hasEnoughData: false` and a zeroed day series.

## 5) Security, Privacy, and Compliance Controls

1. Auth required for all Mood API routes.
2. Server-side validation on every submission and eligibility request. `moodValue` bounds (`1..5` integer) are enforced at the API boundary so an out-of-range value returns `400 mood_invalid_payload`, not a 500.
3. Logs/diagnostics enforce data minimization and avoid unnecessary request metadata.
4. Mood check-ins are **pseudonymous**: the check-in rows carry no `user_id`, only a server-controlled `pseudonym`, and the `user_id` ↔ `pseudonym` link lives solely in `mood_client_identities`. Cooldown and eligibility key on the pseudonym (resolved from the verified user), so a member can neither bypass the 7-day window by rotating `clientId` nor read another device's eligibility, and the check-in/note data is not directly tied to identity. Deleting the user's `mood_client_identities` row cascades all their check-ins. The aggregate community pulse never reads `user_id`, `client_id`, `pseudonym`, or `note`, so public output stays anonymous.
5. Every `mood.check.submit` and `mood.check.eligibility.fetch` decision (allow and deny) emits a structured audit event via `logMoodAudit` (`lib/mood/audit.ts`): `pluginId`, `command`, `policyDecision` with per-check evidence (submit: `roleCheck`/`moodBoundsCheck`/`cooldownCheck`; eligibility: `roleCheck`/`clientIdCheck`), `dataClassesAccessed`, `targetContext`, and `result`. Both commands are marked `containsPHI` in the access policy.
6. Error mapping is centralized in `lib/mood/_lib.ts` (`moodErrorResponse`): `invalid_payload` → 400, `cooldown_active` → 409, `eligibility_not_found` → 404. The duplicate `app/api/mood/_lib.ts` that lacked the 400/409 cases (so cooldowns surfaced as 500) was removed.

## 6) Web and Android Delivery Status

**Web (desktop + mobile-responsive):** ✅ delivered (design `c5d83c0`, 2026-05-29)
**Android:** ➖ **surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). (Historical: it previously shipped against design `MobileMood.tsx`, 2026-05-31, with "Talk to someone" support links added 2026-07-17, #1600.)

Parity points met:
1. Mood check route/entry, eligibility behavior, and submission outcomes match between web and Android.
2. Cooldown and validation semantics match between web and Android (7-day window, 1–5 scale).
3. No Mood admin parity obligations in web/mobile for this rewrite scope.

Web pixel pass (design `c5d83c0`): the `/apps/mood` shell is rebuilt to `design/.../survivor-hub/Mood.tsx` and its Empty/Loading states. The anonymous check-in flow is wired to the real API — `GET /api/mood/eligibility?clientId=` gates the form (per-device `clientId` persisted in localStorage), and `POST /api/mood/submissions` sends `{ clientId, moodValue, note }` with the `x-ctf-csrf` header. This fixes the prior shell, which called eligibility with no `clientId` and POSTed the wrong field names (both 400'd at runtime). The Community Pulse tab now renders a real aggregate (2026-06-07): `GET /api/mood/community` returns an anonymous 7-day average-mood chart plus check-in counts computed from the existing `mood_submissions` table, with loading/empty/error states and a minimum-sample gate so small samples are withheld. Decomposed into modular sub-components within the rule-116 limits; banned "Phase 2" wording removed.

The Android Mood screen also carries the "Talk to someone" support links (#1600, 2026-07-17): a new **Support** bottom-nav tab mirrors the web `mood-crisis-rail` rail — the same heading, intro, and two in-app links (**Find someone in the Directory**, **Reach out through Foundation**) pointing a struggling member to a community member with mental-health expertise, no external crisis-hotline numbers. Navigation between plugin screens is done by the app shell: `Mood` takes an optional `onNavigate(dest)` callback (`dest` is `'directory' | 'foundation'`), and `App.tsx` wires it to `setSelected(dest)`. When `Mood` is rendered without the callback the link cards degrade to non-interactive (no crash). The Privacy First card stays on the existing Private tab; no schema, route, or contract change.

Android pixel pass (design `MobileMood.tsx`, 2026-05-31): built `ctf/packages/mobile/src/features/mood/Mood.tsx` + `api.ts`; retired `MockMood.tsx`. The screen faithfully translates the `MobileMood.tsx` mockup into React Native primitives — dark-mode only (`#0F1117` background), pink `#EC4899` accent, five-mood emoji picker, optional anonymous note, eligibility gate from `GET /api/mood/eligibility?clientId=`, submission via `POST /api/mood/submissions` with `{ clientId, moodValue, note }` + `x-ctf-csrf: 1` header, cooldown display. The Trends tab now renders the real aggregate community pulse (2026-06-07) from `GET /api/mood/community` — a 7-day average-mood chart plus counts, with loading/empty/error states. Home and Private tabs are pure UI and retained. TypeScript, EOF, and parity gates all pass.

## 7) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 8) Gaps and Known Technical Debt

1. Pseudonymous decoupling restored (2026-06-26): check-ins are now stored under a server-controlled pseudonym with no `user_id` on the row (see §4.1), so the v2 pseudo-anonymity carries into v3. Member-facing copy describes check-ins as **pseudonymous** (stored under a random id kept separate from the account); the community aggregate stays **anonymous** (no per-user data at all).
2. Multi-device behavior (multiple `clientId`s for one authenticated user) is allowed by current schema; the cooldown is one-per-user via the pseudonym, so multiple devices share one cooldown. No UI affordance to reconcile or merge mood history across devices.

## 9) Change Log

- 2026-08-02: **Deletion burn-down batch 1: defense-in-depth entry for `mood_submissions`.** The
  registry deleted only `mood_client_identities` (correct — v3 rows store `user_id` as `''` and
  cascade via the pseudonym FK). It now also deletes `mood_submissions` by `user_id` directly: a
  no-op today, present so any row that ever carries a real id — a legacy import, a future write path
  that forgets the convention — clears with the account instead of surviving as wellbeing data with a
  name on it. Satisfies the deletion-coverage gate added in #2056. Contract updated.
- 2026-07-17: **History-aware back navigation (app-wide sweep).** The member shell's hand-rolled
  back chevron was replaced by the shared `BackChevronButton` — it returns to the previous in-app
  page and falls back to All Apps when there is no in-app history. UI-only; no schema, route, or
  contract change.
- 2026-07-17: **Android "Talk to someone" support links (#1600).** The web Mood support-links rail (`mood-crisis-rail.tsx`) was missing on Android. Added a **Support** bottom-nav tab to `ctf/packages/mobile/src/features/mood/Mood.tsx` that mirrors the web rail: the "Talk to someone" heading, the same intro copy, and two in-app links — **Find someone in the Directory** and **Reach out through Foundation** — that point a struggling member to a community member with mental-health expertise (no external crisis-hotline numbers). Navigation is threaded through a new optional `onNavigate(dest)` prop on `Mood` (`dest` = `'directory' | 'foundation'`, exported as `MoodNavDest`); `App.tsx`'s Mood renderer wires it to the shell's `setSelected(dest)`, matching how `DirectoryList` reaches Foundation. Rendered without the callback, the link cards degrade to non-interactive (never crash). Styling uses the mood accent (`getAppAccent('mood', …)`), consistent with sibling mobile screens. UI/navigation only — no schema, route, or contract change; the Privacy First card is unchanged on the existing Private tab.
- 2026-07-14: **Added refresh controls (app-wide refresh rollout).** Web: shared `RefreshButton` in the desktop and mobile-responsive shell headers (`mood-shell.tsx`); the eligibility fetch was extracted from the mount effect into a `loadEligibility` useCallback shared by the effect and the button, so a refresh re-pulls eligibility without flashing the full-screen loading state. Android: native pull-to-refresh via `RefreshControl` on the screen's `ScrollView` in `Mood.tsx`, wired to the same extracted eligibility loader in background mode. UI-only; no schema, route, or contract change.
- 2026-06-29: Owner-directed — replaced the three external crisis-hotline numbers (National Hotline, Crisis Text Line, RAINN) in the Mood resources rail (`mood-crisis-rail`, web desktop + mobile-responsive) with two in-app links: **Find someone in the Directory** (`/apps/directory`) and **Reach out through Foundation** (`/apps/foundation`), under a "Talk to someone" heading. A struggling member is pointed to a community member with mental-health expertise rather than an outside hotline. Removed the unused `CRISIS_RESOURCES` constant from `mood-shared`. Copy/UI only — no schema, route, or contract change; the Privacy First card is unchanged.
- 2026-06-26: Pseudonymous decoupling (owner-directed; restores the v2 model). Added `mood_client_identities` (`pseudonym` ↔ `user_id`) as the only account link; `mood_submissions` now stores a `pseudonym` and writes `user_id` empty, with a `pseudonym` FK `ON DELETE CASCADE`. New `getOrCreateMoodPseudonym` resolves the server-controlled pseudonym; eligibility/cooldown and inserts key on it (not `user_id`, not `clientId`), so the cooldown stays un-bypassable while check-ins are no longer tied to identity. Idempotent backfill in `schema.sql` pseudonymizes existing rows. Account-deletion registry now deletes `mood_client_identities` by `user_id`; check-ins cascade. `seedMood.mjs`, command-contract `dataAccess` (`+ mood_client_identities`), and the deletion contract updated. Member-facing copy changed from "anonymous"/"never shown" to **pseudonymous** wording for the check-in; the community aggregate remains "anonymous".
- 2026-06-26: Privacy-copy honesty pass (owner-directed follow-up to the account-keyed cooldown). Reworded the now-inaccurate member-facing claims across the web (`mood-crisis-rail`, `mood-sidebar`, `mood-checkin`, `mood-shell`, `mood-community`, `mood-public-shell`, `mood-shared` comment) and mobile (`Mood.tsx`) surfaces: removed "rate-limited per device", "not linked to your account", "never linked to your identity", "zero tracking", "no records", "zero logs retained", "no identity link", and "zero personal data stored". Replaced with the truthful promise that individual check-ins are never shown to anyone and only anonymous, aggregate trends are displayed, one check-in per week. Kept the "100% anonymous" badges and the aggregate-only display claims, which remain accurate. No code-behavior, schema, or contract change.
- 2026-06-26: Code-review sweep fixes (issues #1004–#1011). Cooldown/eligibility now keyed on the authenticated `user_id` instead of the client-supplied `clientId`, closing the 7-day-window bypass and cross-client probing (`getMoodEligibility` queries `WHERE user_id = $1`). Added `moodValue` `1..5` bounds enforcement at the submissions route (returns `400 mood_invalid_payload`). Added `lib/mood/audit.ts` (`logMoodAudit`) and emit an audit event on every submit and eligibility decision, allow and deny, per the audit contract. Aligned the submit response shape to the contract (`checkId`/`submittedAt`, was `id`/`submittedAtIso`) in the repository, route, and mobile `SubmitResponse`. Removed the duplicate `app/api/mood/_lib.ts`; the surviving `lib/mood/_lib.ts` `moodErrorResponse` now maps `invalid_payload`→400 and `cooldown_active`→409 (previously these fell through to 500, so the mobile cooldown message never showed). Corrected `mood.check.submit` / `mood.check.eligibility.fetch` command-contract `dataAccess` from the nonexistent `mood_checks` to the real `mood_submissions`. No schema change.
- 2026-06-12: Android API client (`api.ts`) now calls the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain fetch against an environment-variable base URL with no auth token. No backend, schema, or contract change.
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

- 2026-07-17: **Crisis-rail copy fix — dropped the unverifiable "verified" claim (owner directive; same sweep that removed "Verified Community" from the Commons shell).** The Directory support link in `mood-crisis-rail.tsx` read "Search verified community members by specialty…", but Directory profiles carry no verified state (there is no `verified` column on `directory_profiles`), so the claim was unverifiable. It now reads "Search community members by specialty — including people with mental-health expertise." Copy-only; no backend, schema, route, or contract change.
- 2026-05-31: Seed runtime fix. `seedMood.mjs` now opens its own `pg` Pool and defines a local `withDbTransaction` helper instead of importing the TypeScript `packages/web/lib/db/postgres.ts`, which plain Node (e.g. the Node 20 seed/provision workflows) cannot load. Added `pool.end()` teardown. No change to seeded rows, schema, or API.
- 2026-02-25: Created initial Mood CTF rewrite checklist with locked scope exclusions (no severe-value safety trigger, no announcements, no in-app admin) and standalone-plugin boundary plus authenticated-route baseline using anonymous `clientId` persistence.
