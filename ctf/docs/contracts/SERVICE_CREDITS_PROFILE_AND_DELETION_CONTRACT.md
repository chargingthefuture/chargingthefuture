# ServiceCredits Profile and Deletion Contract (Draft)

This draft uses `PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.

## 1) Plugin Metadata

- Plugin Name: ServiceCredits
- Service Key (lowercase, stable): `service-credits`
- Owner Team: Platform Economy (proposed), Trust & Safety Engineering (proposed)
- Rollout Stage: Planning (core wallet and deletion orchestration)

## 2) Canonical Profile Usage

ServiceCredits uses canonical profile identity for wallet binding, authorization, and deletion orchestration.

- Read fields:
  - `user_id`
  - role/workspace membership context for policy checks
  - account lifecycle/deletion state from canonical account context
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - prevent duplicate identity stores for wallet ownership
  - enforce workspace/account policy checks centrally
  - coordinate plugin deletion and full-account deletion with one canonical identity

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): `service_credits_user_extension`
- Fields:
  - field name: `user_id`
    - type: uuid
    - nullable/default: non-null, FK to canonical profile
    - purpose: identity binding for plugin-scoped wallet ownership
  - field name: `wallet_id`
    - type: uuid/text identifier
    - nullable/default: nullable until wallet provisioned
    - purpose: primary wallet linkage for account holder
  - field name: `wallet_status`
    - type: enum (`active` | `restricted` | `pending_deletion` | `deleted`)
    - nullable/default: default `active`
    - purpose: enforce spend/transfer eligibility and deletion lifecycle gates
  - field name: `deletion_requested_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: plugin-scope or full-account deletion start marker
  - field name: `deletion_request_id`
    - type: uuid/text identifier
    - nullable/default: nullable
    - purpose: bind all deletion/reclaim operations to one request lineage
  - field name: `reclaim_eligible_until`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: 7-day reclaim deadline for pending deletions
  - field name: `service_deleted_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: plugin-scoped deletion completion marker

## 4) Domain Data Owned by Plugin

- Table/entity: `service_credits_wallets`
  - Contains personal data? yes (wallet ownership via user linkage)
  - Retention period: long-lived transactional state while account is active
  - Legal/compliance note: no external cash withdrawal semantics; in-platform value only
- Table/entity: `service_credits_transfers`
  - Contains personal data? yes (wallet linkage, actor/system origin)
  - Retention period: long-lived ledger history
  - Legal/compliance note: append-only transfer evidence for disputes/audit
- Table/entity: `service_credits_escrow_holds`
  - Contains personal data? yes (wallet linkage, origin plugin context)
  - Retention period: until resolved, then retained per transactional policy
  - Legal/compliance note: unresolved escrow blocks irreversible deletion finalization
- Table/entity: `service_credits_account_deletion_reclaims`
  - Contains personal data? minimal (account linkage, reclaim attempt/result)
  - Retention period: compliance retention window
  - Legal/compliance note: required evidence for reclaim-window enforcement and retries
- Table/entity: `service_credits_wallet_tombstones`
  - Contains personal data? minimal (wallet/account references, finalization metadata)
  - Retention period: long-lived immutable compliance record
  - Legal/compliance note: proves wallet was finalized/deleted and prevents resurrection ambiguity
- Table/entity: `service_credits_deletion_events`
  - Contains personal data? minimal (`user_id`, scope, request metadata, result)
  - Retention period: compliance retention window
  - Legal/compliance note: deletion accountability and operational monitoring

## 5) Service-Scoped Deletion Contract

When user deletes ServiceCredits plugin usage only (`DELETE /api/account/service-credits-profile`):

- Delete immediately:
  - `service_credits_user_extension` plugin-scoped preferences/flags not required for ledger integrity
  - `service_credits_credit_limits` row for the member — current-state configuration, not ledger
    history: with the wallet tombstoned there is nothing left for a limit to bound, so the row goes
    rather than keeping a raw id alive in a settings table (the admin who set past limits remains in
    the governance/audit records below)
- Anonymize/pseudonymize:
  - user linkage in plugin-owned non-ledger projections where policy permits
- Retain for compliance/fraud/finance:
  - `service_credits_wallets`, `service_credits_transfers`, and `service_credits_escrow_holds` required for ledger integrity and dispute evidence
  - `service_credits_disputes` and `service_credits_dispute_adjustments` — the accountability record
    of contested credit movements and how they were resolved
  - `service_credits_governance_events` — the system-of-record for supply changes (mints, burns,
    grants) and their targets
  - `service_credits_treasury_events` and `service_credits_treasury_config` — treasury movements and
    the admin audit of treasury settings
  - `service_credits_deletion_events` and reclaim records
- Never touch (must remain):
  - canonical account identity
  - non-ServiceCredits plugin data
  - immutable ledger/tombstone evidence
- User-facing confirmation text:
  - “Delete ServiceCredits plugin profile data only? Your account remains active and wallet ledger records required for compliance are retained.”

## 6) Full-Account Deletion Contract

When user requests full account deletion (`DELETE /api/account/full-account`):

- Required lifecycle behavior:
  - wallet state moves to `pending_deletion` and spend/transfer operations are denied immediately
  - reclaim window is exactly 7 days from `deletion_requested_at`
  - unresolved escrow holds mean reclaim/finalization is blocked and retried until escrow state is resolved
- Finalization behavior (after reclaim window and escrow resolution):
  - atomic operation transfers remaining wallet balance to treasury and creates `service_credits_wallet_tombstones` record
  - deletion idempotency key is `account_id + deletion_request_id`
  - immutable event `account_deleted_and_returned_to_treasury` is emitted once finalization succeeds
- Financial boundary:
  - no external withdrawal path is allowed at any step of full-account deletion
- Cross-service dependencies:
  - full-account deletion orchestrator controls global sequencing; ServiceCredits participates as a required dependency stage
- Final expected state:
  - no active user wallet; only policy-required immutable ledger/audit/tombstone artifacts remain

## 7) Rejoin/Re-enable Behavior

If user returns after plugin-scoped deletion:

- Recreated defaults:
  - new/rehydrated `service_credits_user_extension` with `wallet_status = active` when policy allows plugin access
- Data that is not restored:
  - deleted plugin-scoped preference state and prior reclaim attempt transient markers
- Re-consent required? (yes/no):
  - yes, for ServiceCredits scope and wallet-operation consent surfaces

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `reason_code`, `requestId`, `traceId`, `deletionRequestId`
- Event table/path:
  - `service_credits_deletion_events`
  - `service_credits_account_deletion_reclaims`
  - immutable wallet finalization/tombstone stream including `account_deleted_and_returned_to_treasury`
- Who can trigger deletion:
  - authenticated end user for plugin-scoped deletion
  - authorized full-account orchestrator/system actor for full-account deletion
- Alerting/monitoring requirement:
  - alert on deletion failures, escrow-blocked retries beyond threshold, and duplicate-idempotency-key conflicts

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/service-credits-profile` (planned)
- Internal reclaim execute route:
  - `POST /api/internal/service-credits/accounts/{accountId}/deletion-reclaims/{deletionRequestId}/execute` (orchestrator/internal actor only)
- Full account delete endpoint (or orchestrator):
  - `DELETE /api/account/full-account` (platform orchestrator; ServiceCredits is a required dependency)
- Status model (`requested`, `pending_deletion`, `processing`, `completed`, `failed`, `reclaim_blocked`):
  - required for plugin and full-account flows with explicit pending/reclaim states
- User-facing copy reviewed by:
  - Product, Compliance/Privacy, Finance Controls, Trust & Safety

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse-order rollback for ServiceCredits deletion/reclaim/tombstone extension tables only, with hard stop if ledger integrity checks fail
- Backfill required? (yes/no):
  - yes (initialize extension rows and pending-deletion defaults for existing wallets)

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries and idempotency semantics
- [ ] Compliance/privacy reviewed retention, reclaim window, and full-account deletion
- [ ] Finance controls reviewed treasury-return finalization behavior
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed

## 12) Mutual-Credit Default at Deletion

- A member who used the mutual-credit rail may hold a negative balance (they paid past zero, down to their
  per-account credit limit, and had not yet earned back to zero).
- At full-account deletion finalization, a negative final balance is a **mutual-credit default**: the
  treasury (the community) absorbs the shortfall. The reclaim path debits the treasury wallet by the
  shortfall and records an immutable `mutual_credit_default` ledger entry referencing the deleted account.
- Exposure is bounded by small per-account credit limits (default 0 — new accounts cannot go negative at
  all) and is treasury-reserve accounting, excluded from GDP recognition like other reclaim outcomes.
- No external withdrawal or fiat path is involved.

## Change Log

- 2026-06-15: Added the mutual-credit default rule (§12): a negative balance at full-account deletion is a treasury-absorbed `mutual_credit_default`, bounded by small per-account credit limits.
- 2026-02-25: Created initial ServiceCredits profile/deletion contract with plugin-scoped deletion, full-account pending-deletion + reclaim window rules, escrow-blocked retry semantics, treasury-return finalization, and tombstone/audit requirements.
