# Announcements Profile and Deletion Contract (Draft)

## 1) Plugin Metadata

- Plugin Name: Announcements
- Service Key (lowercase, stable): `announcements`
- Owner Team: Communications Platform (proposed)
- Rollout Stage: Planning

## 2) Canonical Profile Usage

Rule 114 baseline: Announcements uses the single canonical profile and does not create duplicate identity stores.

- Read fields:
  - `user_id`
  - display name
  - avatar URL
  - locale/timezone
- Write fields:
  - none
- Why canonical fields are needed:
  - audience targeting and read-state ownership
  - consistent identity across plugins

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): `announcement_user_state` (the real
  per-user state table; the planning-draft name `announcements_user_extension`
  was never created and is reconciled to `announcement_user_state` here)
- Fields:
  - field name: `user_id`
    - type: uuid
    - nullable/default: non-null, FK to canonical profile
    - purpose: per-user state ownership key
  - field name: `announcement_id`
    - type: uuid
    - nullable/default: non-null, FK to `announcements`
    - purpose: which announcement this state row is for
  - field name: `read_at` / `acknowledged_at` / `dismissed_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: per-user read, acknowledge, and dismiss state
  - field name: `updated_at`
    - type: timestamptz
    - nullable/default: maintained on write
    - purpose: last-touched marker

## 4) Domain Data Owned by Plugin

- Table/entity: `announcements_posts`
  - Contains personal data? yes (creator linkage)
  - Retention period: long-lived
  - Legal/compliance note: organizational communication record
- Table/entity: `announcements_reactions`
  - Contains personal data? yes (user linkage)
  - Retention period: medium-lived
  - Legal/compliance note: user engagement metadata
- Table/entity: `announcements_delivery_events`
  - Contains personal data? yes (recipient linkage)
  - Retention period: medium-lived
  - Legal/compliance note: delivery/ack evidence
- Table/entity: `announcements_deletion_events`
  - Contains personal data? minimal (`user_id`, scope, timestamps)
  - Retention period: compliance retention window
  - Legal/compliance note: Rule 114 deletion audit trail

## 5) Service-Scoped Deletion Contract

When user deletes Announcements usage only:

- Delete immediately:
  - `announcement_user_state` rows for requester
  - requester read-state and preference records
- Anonymize/pseudonymize:
  - historical reaction ownership where retention is required
- Retain for compliance/fraud/finance:
  - `announcements_deletion_events`
  - policy-required delivery evidence
- Never touch (must remain):
  - canonical profile
  - announcement posts owned by other users/system actors
- User-facing confirmation text:
  - “Delete Announcements plugin data only? Your account remains active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - remaining user-linked read, reaction, and preference records
- Cross-service dependencies:
  - full-account orchestrator coordinates all plugins from canonical account deletion workflow
- Final expected state:
  - no recoverable user-scoped Announcements data, except policy-required audit evidence

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - new `announcement_user_state` rows created lazily on next read/ack
- Data that is not restored:
  - deleted read/reaction state
- Re-consent required? (yes/no):
  - yes (notification preferences)

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - `announcements_deletion_events`
- Who can trigger deletion:
  - authenticated user (self)
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on deletion failures and retry spikes

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/announcements-profile` (planned)
- Full account delete endpoint (or orchestrator):
  - `DELETE /api/account/full-account`
- Status model (`requested`, `processing`, `completed`, `failed`):
  - required for plugin and account deletion flows
- User-facing copy reviewed by:
  - Product, Compliance/Privacy

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse-order rollback for Announcements-only extension/deletion tables
- Backfill required? (yes/no):
  - no

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed

## Change Log

- 2026-02-25: Created initial draft.
- 2026-06-01: Reconciled the planning-draft phantom table `announcements_user_extension`
  to the real per-user state table `announcement_user_state` (read/ack/dismiss state).
  The phantom never existed in `ctf/schema.sql` and no code referenced it. This completes
  the announcements half of backend-drift decision #4 (remove phantom table references).
