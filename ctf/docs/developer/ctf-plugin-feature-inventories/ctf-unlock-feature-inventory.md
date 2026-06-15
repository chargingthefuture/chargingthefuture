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

Internal (cron) routes:

- `POST /api/internal/unlock/reconcile-rewards` — `CRON_SECRET`-guarded (Bearer). Drains the approved-but-uncredited reward backlog and mints each idempotently (actor `unlock-incentive-system`, key `unlock-approval-submission-<id>`), then sets `incentive_granted_at`. Self-heals a reward whose mint failed on approval; can never double-grant. Returns `{ scanned, granted, alreadyGranted, failed }`. Scheduled hourly by `.github/workflows/unlock-reward-reconciliation.yml`.

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
6. **Unlock is the single source of truth for full app access (hard cutover, 2026-06-09).** The old v2 `isApproved` flag — which came from an `x-ctf-user-approved` header the middleware never set, so it defaulted to true for everyone — has been removed entirely from the request identity, the bearer-token identity, and the access decision. The central gate `evaluatePluginAccess` now resolves the Unlock tier via `getUnlockAccessTier` (Unleash flag, then DB tier with lazy expiry) and enforces a single `minUnlockTier` option:
   - `approved_full` (default): only fully-approved members or admins may enter. Every plugin route, the Chyme service routes, and all admin pages use this. A not-yet-verified member is denied with reason `unlock_required` and sent into the Unlock flow.
   - `support_only`: approved or `locked_support_only` members may enter. Used by the Hub general channel (`/api/hub/**`), which is the support surface for not-yet-verified members — they can read and post there to ask for help (for example, finding their Quora profile link).
   - `any_authenticated`: any signed-in member may enter regardless of tier. Used by the Unlock submission/status routes (so a gated member can always submit) and the account/profile/deletion routes (so a gated member can always see and delete their own data, i.e. exercise the right to be forgotten).
7. Admins always pass the tier check.
8. **Chyme is no longer granted to not-yet-unlocked members.** Chyme requires `approved_full`; degraded members are pointed at the Hub general channel and the Unlock flow instead. Chyme's anonymous public visitor shell (for signed-out browsing) is unchanged.

## 6) Web and Android Delivery Strategy

1. Backend-first delivery with web admin moderation shell.
2. Android parity for submission/status surfaces follows shared contracts.
3. Access-tier semantics remain consistent across web and Android.
4. Web pixel pass (design `c5d83c0`): the user-facing `/plugin/unlock` page is rebuilt to `design/.../survivor-hub/Unlock.tsx` and its Empty/Loading states. `UnlockShell` reads `GET /api/unlock/status` and renders the loading state, the submission form (no submission), or the status view (pending/approved/rejected, with a re-submit form on rejection). Submission and re-submission POST to `/api/unlock/submission` (replacing the previous stub form, which never called the API). Status label, the timeline, the "what you unlock" checklist, and the approved/rejected variants are driven by the real `UnlockStatus`; the mockup's dummy URL, rejection text, and timestamps (absent from the status endpoint) are not fabricated. ClickLog-style dark layout decomposed into modular sub-components within rule-116 limits.
5. Android pixel pass (2026-05-31): `ctf/packages/mobile/src/features/unlock/Unlock.tsx` rewritten to `MobileUnlock.tsx` / `MobileUnlockEmpty.tsx` / `MobileUnlockLoading.tsx` / `MobileUnlockPublic.tsx` mockup. Created `api.ts` binding `GET /api/unlock/status` and `POST /api/unlock/submission`. Four states: loading (tagline splash), public (unauthenticated — 401/403 path), submission form (no prior submission), status view (pending/approved/rejected with re-submit on rejection). MockUnlock.tsx was already empty and is not exported. Real-data bindings: `UnlockStatus.reviewStatus`, `.accessTier`, `.hasSubmission`. Omitted per real-data-only rule: `quoraProfileUrl` (absent from status endpoint), timeline dates (`submittedAt`/`reviewedAt` absent), `reviewNote` (absent from status endpoint). No CSRF header needed (mirrors web unlock shell which does not set `x-ctf-csrf`).
6. Android admin parity (2026-06-07): added `ctf/packages/mobile/src/features/unlock/AdminUnlock.tsx` (new `unlock-admin` App.tsx key) and `admin-api.ts`. The screen lists the pending verification queue and adds per-submission Approve / Reject actions, mirroring the web admin's review action and the `MobileUnlockAdmin.tsx` mockup. Binds only existing endpoints — `GET /api/unlock/admin/submissions?reviewStatus=pending` and `POST /api/unlock/admin/submissions/:submissionId/review` (with `x-ctf-csrf: '1'`). Admin-gated server-side (`requireUnlockAdminAccess`); a 401/403 shows an "admins only" notice. Each decision is confirm-gated via `Alert.alert`. Reject sends `reviewStatus: 'rejected'` with no free-text reason (the route's `reviewNote` is optional and `Alert.prompt` is iOS-only); the `spam` decision the route also accepts is not surfaced, matching the web admin and the mockup's two-button Grant/Deny.

## 7) Seed Coverage Status

Seed script requirement: deterministic Unlock seed scenarios for pending, approved, rejected, and spam states.

## 8) Gaps and Known Debt

1. Platform-wide, centralized enforcement for support-only tier is implemented in the auth layer (`evaluatePluginAccess`).
2. `/api/unlock/status` endpoint provides current Unlock access tier and status for the authenticated user.
3. Incentive amount is now sourced from runtime config.
4. Reminder scheduler and cadence delivery worker are pending implementation.

## 9) Change Log

- 2026-06-15: Self-healing reward reconciliation + reward-status UI. The approval reward mint is best-effort (it must not fail the approval), so a transient failure left the reward unissued with no retry. Added a background reconciliation: `lib/unlock/reconcile-rewards.ts` (`reconcileUnlockRewards`) + `listApprovedUnincentivizedSubmissions` find approved submissions with `incentive_granted_at IS NULL` and mint each idempotently (actor `unlock-incentive-system`, key `unlock-approval-submission-<id>`, then `markUnlockIncentiveGranted`); exposed at `POST /api/internal/unlock/reconcile-rewards` (`CRON_SECRET` Bearer) and scheduled hourly by `.github/workflows/unlock-reward-reconciliation.yml`. UI: the admin submission view now shows "Reward granted" vs "Reward pending" (from `incentiveGrantedAt`) on approved submissions, and member + admin copy states the reward "arrives within N hours" using the shared `UNLOCK_REWARD_SLA_HOURS` (24) from `@ctf/shared`. No schema change. So a member can be told a definite window and the operator can see at a glance whether a reward landed.
- 2026-06-13: Fixed the admin Approve action returning `503` (review failed). On approval the route also grants the Unleash flag and mints the ServiceCredits verification reward; if a provider (Unleash admin API or the Formance ledger) was unavailable, the thrown error fell through to the route's catch and 503'd the whole approval (Reject/Spam, which have no such follow-ups, worked). The verification decision is committed before those follow-ups, so they are now wrapped in a best-effort `try/catch` (reported to Sentry) and no longer fail the approval. The mint stays idempotent (`idempotencyKey` + `markUnlockIncentiveGranted`), so a later retry will not double-grant. No schema or contract change.
- 2026-06-13: Web admin design pass. Replaced the bare diagnostic `/admin/unlock` page with `components/unlock/unlock-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, snapshot stat blocks, Pending/All tabs, status-pill submission cards) following the `MobileUnlockAdmin.tsx` mockup's visual language but bound to the real Quora-verification queue. Shows the real `getUnlockDashboardSnapshot` counts and `listUnlockSubmissions` records; Approve / Reject / Spam call the existing `POST /api/unlock/admin/submissions/:submissionId/review` (with `x-ctf-csrf: '1'`) and refresh. No fabricated data — the mockup's invented "access gates" model was not implemented because it does not match this backend. No new endpoint, schema, or contract.
- 2026-06-12: Android API clients (`api.ts`, `admin-api.ts`) now call the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminUnlock.tsx` call sites updated. No backend, schema, or contract change.
- 2026-06-09: Unlock made the single source of truth for full app access (hard cutover). Removed the vestigial v2 `isApproved` flag everywhere — `RequestIdentity`, the bearer-token `VerifiedBearerIdentity`, and the `AllowDecision` no longer carry it, and the `x-ctf-user-approved` / `is_approved` reads are gone. `lib/unlock/access.ts` gained `getUnlockAccessTier(userId)` (Unleash flag first, then the DB tier with lazy expiry) and `isUserUnlocked` now wraps it. `evaluatePluginAccess` replaced its two old options (`requireApprovedUserOrAdmin`, `allowUnlockSupportOnly`) with one `minUnlockTier` (`approved_full` default / `support_only` / `any_authenticated`); denials use the new `unlock_required` reason (the old `unlock_support_only` reason was removed). Hard cutover: only `approved_full` members (or admins) get full app access — everyone else lands in the Unlock flow. `locked_support_only` members get the Hub general channel (read + post) as their support surface; the home page renders the normal Hub for them (nothing is hidden), and redirects `pending_readonly`/unsubmitted members to `/plugin/unlock`. On a plugin route, a not-yet-verified signed-in member (and a signed-out visitor) sees that plugin's public landing page instead of a denial wall, so they can browse and are nudged toward the Unlock flow. Chyme is no longer granted to not-yet-unlocked members (its anonymous public shell is untouched); copy that previously pointed degraded users at Chyme now points them at the Hub general channel and the Unlock flow. Route access posture: Unlock submission/status and account/profile/deletion routes use `any_authenticated`; the Hub uses `support_only`; everything else uses the default `approved_full`. The now-dead `lib/chyme/policy.ts` (`ensureApprovedUserOrAdmin`) was removed. No schema or contract change.
- 2026-06-07: Android Unlock admin actions. Added `ctf/packages/mobile/src/features/unlock/AdminUnlock.tsx` and `admin-api.ts`, registered as a new `unlock-admin` key in `App.tsx`. The Android admin now has the review actions (Approve / Reject) the web admin already supports, instead of being status-only. Binds only the existing endpoints `GET /api/unlock/admin/submissions` and `POST /api/unlock/admin/submissions/:submissionId/review` (mutations send `x-ctf-csrf: '1'`); no new backend. Admin enforcement is server-side; non-admins see an "admins only" notice. Actions are confirm-gated. List keys sit on `<React.Fragment>`, never on host components. Web admin `/admin/unlock` reviewed for responsiveness: already single-column (`max-w-5xl`, stacked `space-y` sections) so no breakpoint change was needed. Gap noted: the review endpoint also accepts a `spam` decision and an optional `reviewNote`, neither of which is surfaced on mobile (matches the web admin and the mockup).
- 2026-06-01: Home page (`app/page.tsx`) now forwards a signed-in-but-not-yet-unlocked member to `/plugin/unlock` instead of rendering the anonymous "please sign in" community shell, which made signing in look like it did nothing. The home access check denies an anonymous visitor with 401 (`AUTH_UNAUTHORIZED`) and a signed-in pending member with 403; only the 403 case is redirected. No route, schema, or contract change — entry-point routing only.
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

- 2026-06-09: A signed-in member who is not yet verified, when browsing a plugin's public landing page, now sees a single "Finish verifying" call-to-action that points at the Unlock flow (`/plugin/unlock`) instead of the anonymous "Sign In" / "Join Free" buttons. This is delivered through a new optional `verifyUrl` prop on the public visitor shells (`PublicVisitorShellProps`); the plugin route page (`app/apps/[pluginSlug]/page.tsx`) passes `verifyUrl="/plugin/unlock"` only when access is denied with `unlock_required` (a signed-in-but-not-verified member) and omits it for an anonymous visitor. Anonymous visitors are unchanged. No schema or contract change.

- 2026-06-01: Multi-currency (issue #120): added `incentive_currency` (FK → `currencies.code`, default ServiceCredits) to `unlock_runtime_config`, naming the currency of `incentive_amount`. Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.

- 2026-03-25: Created initial Unlock rewrite checklist with contracts, schema, submission/moderation, incentive, and access-tier enforcement phases.
