# GentlePulse Profile and Deletion Contract (Draft)

## 1) Plugin Metadata

- Plugin Name: GentlePulse
- Service Key (lowercase, stable): `gentle-pulse`
- Owner Team: Wellbeing Experiences (proposed)
- Rollout Stage: Planning

## 2) Canonical Profile Usage

Rule 114 baseline: GentlePulse uses canonical profile identity and stores plugin-specific fields by `user_id`.

- Read fields:
  - `user_id`
  - display name
  - locale/timezone
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - user-owned check-in history and reminder delivery ownership

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): `gentle_pulse_user_extension`
- Fields:
  - field name: `user_id`
    - type: uuid
    - nullable/default: non-null, unique, FK to canonical profile
    - purpose: plugin extension ownership key
  - field name: `checkin_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: check-in cadence and prompt settings
  - field name: `reminder_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: reminder channels and quiet hours
  - field name: `service_deleted_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: plugin-scoped deletion marker

## 4) Domain Data Owned by Plugin

- Table/entity: `gentle_pulse_checkins`
  - Contains personal data? yes (wellbeing entries)
  - Retention period: user-controlled with policy minimums
  - Legal/compliance note: sensitive wellbeing data
- Table/entity: `gentle_pulse_reminders`
  - Contains personal data? yes (schedule + user linkage)
  - Retention period: short/medium-lived
  - Legal/compliance note: operational metadata only
- Table/entity: `gentle_pulse_trends_cache`
  - Contains personal data? yes (derived user insights)
  - Retention period: short-lived recomputable cache
  - Legal/compliance note: avoid sensitive text payloads
- Table/entity: `gentle_pulse_deletion_events`
  - Contains personal data? minimal (`user_id`, scope, timestamps)
  - Retention period: compliance retention window
  - Legal/compliance note: Rule 114 deletion audit trail

## 5) Service-Scoped Deletion Contract

When user deletes GentlePulse usage only:

- Delete immediately:
  - `gentle_pulse_user_extension`
  - user check-ins, reminder schedules, and trends cache
- Anonymize/pseudonymize:
  - none expected; plugin data is user-scoped and removable
- Retain for compliance/fraud/finance:
  - `gentle_pulse_deletion_events`
- Never touch (must remain):
  - canonical profile
  - non-GentlePulse plugin data
- User-facing confirmation text:
  - “Delete GentlePulse plugin data only? Your account remains active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - remaining user-linked GentlePulse data not already deleted
- Cross-service dependencies:
  - full-account orchestrator handles sequencing across all plugins
- Final expected state:
  - no recoverable user-scoped GentlePulse data except deletion audit records required by policy

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - new `gentle_pulse_user_extension` with default cadence
- Data that is not restored:
  - deleted check-ins and reminder history
- Re-consent required? (yes/no):
  - yes (wellbeing tracking and reminders)

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - `gentle_pulse_deletion_events`
- Who can trigger deletion:
  - authenticated user (self)
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on deletion failures and queue retries

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/gentle-pulse-profile` (planned)
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
  - reverse-order rollback for GentlePulse-only extension/deletion tables
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
