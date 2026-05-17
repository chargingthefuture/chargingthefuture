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

## 7) Seed Coverage Status

Seed script requirement: deterministic Unlock seed scenarios for pending, approved, rejected, and spam states.

## 8) Gaps and Known Debt

1. Platform-wide, centralized enforcement for support-only tier is implemented in the auth layer (`evaluatePluginAccess`).
2. `/api/unlock/status` endpoint provides current Unlock access tier and status for the authenticated user.
3. Incentive amount is now sourced from runtime config.
4. Reminder scheduler and cadence delivery worker are pending implementation.

## 9) Change Log

- 2026-03-25: Created initial Unlock CTF rewrite inventory with staged access, admin moderation queue, and one-time approval incentive scope.
- 2026-03-25: Updated for platform-wide enforcement, runtime-config incentive, and status endpoint implementation.
