# Unlock Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` remains reference-only and must not be modified.
- Plugin name: `Unlock`
- Plugin slug / service key: `unlock`
- Visibility requirement:
  - hidden from end-user plugin listings,
  - available in admin contexts where applicable.

## Intent and Outcome

Unlock governs staged access for new accounts that must submit a Quora profile URL for trust verification.

This plugin must:

1. collect and normalize Quora profile submissions,
2. keep users in read-only access while pending review,
3. move expired/unverified users to support-only access tier,
4. allow admin moderation decisions (approve/reject/spam),
5. award one-time service-credit incentive on approval,
6. preserve full audit trail for allow/deny/moderation/reward operations.

## 1) User Features

### 1.1 Verification Submission

1. Submit a Quora profile URL.
2. Validate and normalize URL before persistence.
3. Replace previous pending submission for the same user deterministically.

### 1.2 Staged Access Experience

1. Pending users are read-only until verified.
2. Unverified users after window expiry become support-only.
3. Approved users transition to full access.

### 1.3 Verification Guidance

1. Show concise safety copy for why Quora URL is requested.
2. Show acceptable URL format examples.
3. Show review state and next-step status text.

## 2) Admin Features

### 2.1 Moderation Queue

1. List submissions by status/access-tier filters.
2. Review with decisions: `approved`, `rejected`, `spam`.
3. Capture reviewer and optional moderation note.

### 2.2 Incentive Governance

1. On approval, issue a one-time 100 service-credit reward.
2. Enforce deterministic idempotency for reward grants.
3. Persist grant timestamp on unlock submission state.

### 2.3 Auditability and Operations

1. Audit allow/deny outcomes for submission and moderation commands.
2. Audit service-credit governance event correlation for reward grants.
3. Provide API contracts suitable for Retool-based admin queue UX.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface (Authoritative)

1. `unlock.verification.submit`
2. `unlock.admin.submission.list`
3. `unlock.admin.submission.review`
4. `unlock.incentive.approval.credit-grant`

### 3.2 HTTP Projection Routes

User routes:

- `POST /api/unlock/submission`

Admin routes:

- `GET /api/unlock/admin/submissions`
- `POST /api/unlock/admin/submissions/:submissionId/review`

Admin page:

- `GET /admin/unlock`

## 4) Data Model and Storage Contracts

### 4.1 Domain Entities

1. `unlock_runtime_config`
2. `unlock_verification_submissions`
3. `unlock_audit_log`

Multi-currency (issue #120): `unlock_runtime_config` carries `incentive_currency` (FK → `currencies.code`),
naming the currency of `incentive_amount`. It defaults to ServiceCredits (code `SC`) — the approval
incentive is an internal token grant. No surface renders a ServiceCredits amount at a fiat equivalent.

### 4.2 Stored State

1. review status: `pending | approved | rejected | spam`
2. access tier: `pending_readonly | locked_support_only | approved_full`
3. unlock window expiration timestamp
4. reminder stage marker
5. incentive grant timestamp

## 5) Security, Privacy, and Compliance Controls

1. Server-side auth gates for all routes.
2. Admin-only moderation and queue access.
3. Input normalization and strict Quora URL shape validation.
4. Auditable moderation and reward grant traces.
5. Plugin remains hidden from end-user plugin registry navigation.

## 6) Web and Android Delivery Strategy

1. Backend-first delivery with web admin moderation shell.
2. Android parity for submission/status surfaces follows shared contracts.
3. Access-tier semantics remain consistent across web and Android.
4. Web pixel pass (design `c5d83c0`): the user-facing `/plugin/unlock` page is rebuilt to `design/.../survivor-hub/Unlock.tsx` and its Empty/Loading states. `UnlockShell` reads `GET /api/unlock/status` and renders the loading state, the submission form (no submission), or the status view (pending/approved/rejected, with a re-submit form on rejection). Submission and re-submission POST to `/api/unlock/submission` (replacing the previous stub form, which never called the API). Status label, the timeline, the "what you unlock" checklist, and the approved/rejected variants are driven by the real `UnlockStatus`; the mockup's dummy URL, rejection text, and timestamps (absent from the status endpoint) are not fabricated. ClickLog-style dark layout decomposed into modular sub-components within rule-116 limits.
5. Android pixel pass (2026-05-31): `ctf/packages/mobile/src/features/unlock/Unlock.tsx` rewritten to `MobileUnlock.tsx` / `MobileUnlockEmpty.tsx` / `MobileUnlockLoading.tsx` / `MobileUnlockPublic.tsx` mockup. Created `api.ts` binding `GET /api/unlock/status` and `POST /api/unlock/submission`. Four states: loading (tagline splash), public (unauthenticated — 401/403 path), submission form (no prior submission), status view (pending/approved/rejected with re-submit on rejection). MockUnlock.tsx was already empty and is not exported. Real-data bindings: `UnlockStatus.reviewStatus`, `.accessTier`, `.hasSubmission`. Omitted per real-data-only rule: `quoraProfileUrl` (absent from status endpoint), timeline dates (`submittedAt`/`reviewedAt` absent), `reviewNote` (absent from status endpoint). No CSRF header needed (mirrors web unlock shell which does not set `x-ctf-csrf`).

## 7) Seed Coverage Status

Seed script requirement: deterministic Unlock seed scenarios for pending, approved, rejected, and spam states.

## 8) Gaps and Known Debt

1. Platform-wide, centralized enforcement for support-only tier is implemented in the auth layer (`evaluatePluginAccess`).
2. `/api/unlock/status` endpoint provides current Unlock access tier and status for the authenticated user.
3. Incentive amount is now sourced from runtime config.
4. Reminder scheduler and cadence delivery worker are pending implementation.

## 9) Change Log

- 2026-05-31: Android pixel pass. Rewrote `ctf/packages/mobile/src/features/unlock/Unlock.tsx` to the `MobileUnlock.tsx` + Empty/Loading/Public mockup; created `api.ts` (GET status, POST submission). Four RN states (loading, public, submission form, status view). MockUnlock.tsx was already empty. No schema/API change.
- 2026-05-29: Web UI circle-back (first design pass; unblocked by the `c5d83c0` design re-pin). Rebuilt the `/plugin/unlock` page to the `Unlock.tsx` mockup + Empty/Loading states, wired to `/api/unlock/status` and `/api/unlock/submission` (the prior `UnlockSubmission` stub never posted; removed). Decomposed into modular sub-components (`unlock-shared`, `unlock-loading`, `unlock-icon-rail`, `unlock-submission-view`, `unlock-sidebar`, `unlock-status-card`, `unlock-right-rail`, `unlock-status-view`, `unlock-shell`). Status/timeline driven by real data; no fabricated URL/reason/timestamps. No schema/API change.
- 2026-03-25: Created initial Unlock CTF rewrite inventory with staged access, admin moderation queue, and one-time approval incentive scope.
- 2026-03-25: Updated for platform-wide enforcement, runtime-config incentive, and status endpoint implementation.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work required in `platform/`.
- [ ] Confirm plugin slug and command namespace lock.
  - Acceptance criteria:
    - Stable plugin slug is `unlock` across docs/contracts/routes.
- [ ] Confirm visibility policy.
  - Acceptance criteria:
    - Hidden in end-user plugin listing and available in admin contexts.

### �� Contract Lock

- [ ] Define Unlock plugin command contracts for v1.
  - Acceptance criteria:
    - Every command conforms to `201-plugin-command-schema-template.mdc`.
- [ ] Define Unlock access policy contracts for v1.
  - Acceptance criteria:
    - Every command has role/attribute/consent/region/deny semantics under `202` template.
- [ ] Define Unlock audit contracts for v1.
  - Acceptance criteria:
    - Every command has allow/deny + result audit coverage under `203` template.
- [ ] Verify command parity across command/access/audit files.
  - Acceptance criteria:
    - Command set matches across all three contract files.

### �� Schema and Persistence

- [ ] Implement Unlock schema and migration(s) in `ctf/migrations/`.
  - Acceptance criteria:
    - Runtime config, submissions, and audit tables exist with constraints/indexes.
- [ ] Implement submission state model and transitions.
  - Acceptance criteria:
    - `pending`, `approved`, `rejected`, `spam` and access-tier transitions are deterministic.
- [ ] Implement incentive grant state marker.
  - Acceptance criteria:
    - Incentive grant is tracked and cannot be double-marked.

### �� User Submission Flow

- [ ] Implement Quora URL submission endpoint.
  - Acceptance criteria:
    - URL required, normalized, host/path validated, and persisted by user.
- [ ] Implement audit writes for allow/deny submissions.
  - Acceptance criteria:
    - Invalid URL and accepted submission outcomes are auditable.

### �� Admin Moderation Flow

- [ ] Implement admin queue listing endpoint.
  - Acceptance criteria:
    - Supports status/tier filters and bounded limit.
- [ ] Implement admin moderation endpoint.
  - Acceptance criteria:
    - Supports approve/reject/spam with reviewer attribution.
- [ ] Implement admin Unlock shell page.
  - Acceptance criteria:
    - Queue snapshot and pending submissions render for admins only.

### �� Incentive Integration

- [x] Implement one-time service-credits grant on approval (runtime-configurable).
  - Acceptance criteria:
    - Approval triggers service-credit mint (amount from runtime config) with deterministic idempotency key.
- [ ] Persist incentive grant marker and audit correlation.
  - Acceptance criteria:
    - Unlock submission stores grant timestamp and service-credits event is auditable.

### �� Access-Tier Enforcement

- [x] Implement platform-wide, centralized access-tier policy integration.
  - Acceptance criteria:
    - Pending users are read-only, expired users are support-only, approved users get full access. Centralized in auth layer with explicit exceptions for Chyme/Unlock APIs and deletion.
- [ ] Implement expiry transition job/path.
  - Acceptance criteria:
    - Pending submissions past window can transition to support-only without manual edits.

### �� Validation and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Command schema design documentation.
  - Acceptance criteria:
    - Invalid/unknown field behavior is documented.
- [ ] Access policy and audit design documentation.
  - Acceptance criteria:
    - Unauthorized/invalid transition cases are documented.
- [ ] Deterministic seed scenarios.
  - Acceptance criteria:
    - Seed data includes pending/approved/rejected/spam sample paths.

### Open Decisions Tracker

- [ ] Final copy for survivor-facing verification messaging.
- [ ] Reminder delivery mechanism (cron worker vs event queue).
- [ ] Dynamic incentive amount source of truth (runtime config vs policy constant).

### Change Log

- 2026-06-01: Multi-currency (issue #120): added `incentive_currency` (FK → `currencies.code`, default ServiceCredits) to `unlock_runtime_config`, naming the currency of `incentive_amount`. Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.

- 2026-03-25: Created initial Unlock rewrite checklist with contracts, schema, submission/moderation, incentive, and access-tier enforcement phases.
