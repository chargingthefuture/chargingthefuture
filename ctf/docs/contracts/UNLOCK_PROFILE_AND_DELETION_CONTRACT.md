# Unlock Profile and Deletion Contract (Draft)

This draft uses `PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.

## 1) Plugin Metadata

- Plugin Name: Unlock
- Service Key (lowercase, stable): `unlock`
- Owner Team: Trust & Safety (proposed), Platform Identity (proposed)
- Rollout Stage: Initial implementation

## 2) Canonical Profile Usage

Unlock uses canonical identity for authentication, submission ownership, and moderation target context.

- Read fields:
  - `user_id`
  - role/admin state for policy checks
  - approval metadata context for access gating orchestration
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - preserve single-profile architecture
  - avoid duplicate identity stores
  - apply centralized auth and role policy checks

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (`PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Unlock must not introduce plugin-local username ownership.

## 3) Plugin Extension Fields

- Storage location: `unlock_verification_submissions`
- Fields:
  - `user_id` (text, unique)
  - `quora_profile_url` (text)
  - `quora_profile_url_normalized` (text)
  - `review_status` (`pending|approved|rejected|spam`)
  - `access_tier` (`pending_readonly|locked_support_only|approved_full`)
  - `unlock_window_expires_at` (timestamptz)
  - `reminder_stage` (integer)
  - `reviewed_by_user_id` (text, nullable)
  - `reviewed_at` (timestamptz, nullable)
  - `review_note` (text, nullable)
  - `incentive_granted_at` (timestamptz, nullable)

## 4) Domain Data Owned by Plugin

- `unlock_runtime_config`
- `unlock_verification_submissions`
- `unlock_audit_log`
- `unlock_spam_quora_urls`
- `unlock_excluded_accounts`

Retention summary:

1. submission and moderation records are retained as long-lived trust/audit evidence.
2. audit records are append-only and retained per compliance policy.
3. no direct financial ledger ownership (service-credits remains separate owner).
4. `unlock_spam_quora_urls` is a spam denylist keyed on the normalized Quora URL and holding **no
   member identifier**. It is retained through account/data deletion (registered `retain` in the
   account deletion registry) for abuse prevention, so a URL an admin flagged as spam is not lost when
   the flagged member deletes their data. As shipped, `unlock_verification_submissions` is hard-deleted
   on deletion (see the account deletion registry, which is the source of truth over the intent
   described in sections 5–6 below).
5. `unlock_excluded_accounts` holds one row per account an admin marked as demo/test so the Unlock
   admin's sign-up counters leave it out. It is keyed on `user_id` and is hard-deleted with the member's
   other data (registered `del` in the account deletion registry): the account it names no longer
   exists, so the row would count for nothing and there is no abuse-prevention reason to keep it. The
   row grants and revokes nothing — it changes only what the admin sign-up numbers count.

## 5) Service-Scoped Deletion Contract

When user deletes Unlock plugin usage only (planned endpoint):

- Delete/anonymize immediately:
  - plugin-local optional review notes that are not required for compliance evidence (policy-dependent)
- Retain for compliance/trust:
  - status transitions and audit records needed for anti-abuse traceability
- Never touch:
  - canonical account identity
  - service-credits financial ledger records

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Unlock submissions are marked as deleted/account-closed via orchestrator policy.
- Unlock audit evidence required by compliance remains retained in immutable/audit-safe form.
- Unlock must not block full-account deletion on its own once required audit snapshots are persisted.

## 7) Rejoin/Re-enable Behavior

If user returns after deletion:

- new unlock submission can be created for new verification cycle.
- prior moderation decision may remain as historical evidence and should not auto-grant approval.

## 8) Audit and Events

- Events include:
  - submission accepted/denied validation outcomes
  - admin moderation decision outcomes
  - reward grant correlation metadata (submission -> governance event)
- Event storage:
  - `unlock_audit_log`

## 9) API and UX Surface

- Service endpoints:
  - `POST /api/unlock/submission`
  - `GET /api/unlock/status` (returns current Unlock access tier/status for authenticated user)
- Admin endpoints:
  - `GET /api/unlock/admin/submissions`
  - `POST /api/unlock/admin/submissions/:submissionId/review`
- Admin UI:
  - `/admin/unlock`

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse Unlock-only schema objects in migration rollback order.

## 11) Sign-off Checklist

- [ ] Product approved staged unlock behavior.
- [ ] Engineering approved one-time incentive grant path.
- [ ] Compliance/privacy approved retention and deletion behavior.
- [ ] Trust & Safety approved moderation/audit semantics.

## Change Log

- 2026-03-25: Created initial Unlock profile/deletion contract with staged verification, moderation, and audit-retention boundaries.
- 2026-03-25: Updated for platform-wide enforcement, runtime-config incentive, and status endpoint implementation.
