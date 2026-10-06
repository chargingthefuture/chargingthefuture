# Workforce Profile and Deletion Contract

## 1) Plugin Metadata

- Plugin Name: Workforce
- Service Key (lowercase, stable): `workforce`
- Owner Team: Workforce Operations (proposed)
- Rollout Stage: Phase 1 in progress (web/backend)

## 2) Canonical Profile Usage

Rule 114 baseline: Workforce uses a single canonical profile and plugin extension by `user_id`.

- Read fields:
  - `user_id`
  - display name
  - role/workspace membership
  - locale/timezone
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - assignment ownership, permissions, and workforce policy checks

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): `workforce_user_extension` + `workforce_profiles`
- Fields:
  - field name: `user_id`
    - type: uuid
    - nullable/default: non-null, unique, FK to canonical profile
    - purpose: plugin extension ownership key
  - field name: `availability_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: shift and assignment availability
  - field name: `work_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: role and workload preferences
  - field name: `service_deleted_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: plugin-scoped deletion marker

## 4) Domain Data Owned by Plugin

- Table/entity: `workforce_roles`
- Table/entity: `workforce_profiles`
  - Contains personal data? yes (user-linked extension profile)
  - Retention period: medium/long-lived transactional history
  - Legal/compliance note: extension-state accountability
- Table/entity: `workforce_recruited_events`
  - Contains personal data? yes (`user_id`, inferred source metadata)
  - Retention period: long-lived
  - Legal/compliance note: deterministic recruited inference auditability
- Table/entity: `workforce_admin_audit_trail`
  - Contains personal data? minimal (`actor_id`, command metadata)
  - Retention period: compliance retention window
  - Legal/compliance note: admin mutation audit trail

## 5) Service-Scoped Deletion Contract

When user deletes Workforce usage only:

- Delete immediately:
  - none (service deletion uses soft-delete marker for extension consistency)
- Anonymize/pseudonymize:
  - user extension preference payloads reset to empty objects
- Retain for compliance/fraud/finance:
  - policy-required workforce audit evidence
  - `workforce_recruited_events`
  - `workforce_admin_audit_trail`
- Never touch (must remain):
  - canonical profile
  - assignment records still required for operational/compliance history
- User-facing confirmation text:
  - “Delete Workforce plugin data only? Your account remains active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - remaining user-linked workforce preferences and removable assignment links
- Cross-service dependencies:
  - full-account orchestrator handles cross-plugin dependency ordering and completion
- Final expected state:
  - no recoverable user-scoped Workforce data except policy-required compliance artifacts

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - new `workforce_user_extension` with default preferences
- Data that is not restored:
  - removed preference history and hard-deleted assignment links
- Re-consent required? (yes/no):
  - yes (assignment and availability preferences)

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - `account_deletion_events` (`service_name = 'workforce'`), written by the central deletion
    orchestrator (`lib/account/deletion-orchestrator.ts`) for both the service delete and the
    full-account delete
  - the plugin's own `workforce_deletion_events` table, written only by the retired
    `DELETE /api/workforce/profile`, was dropped with its rows on 2026-10-06
    (`post/0052_drop_workforce_deletion_events.sql`); `account_deletion_events` is the only
    deletion event record for Workforce
- Who can trigger deletion:
  - authenticated user (self)
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on deletion failures and policy-retention exceptions

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/services/workforce` (the Account & Data screen's per-service delete,
    run through the central deletion registry). The in-plugin `DELETE /api/workforce/profile` was
    retired 2026-10-05: no screen called it.
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
  - reverse-order rollback for Workforce-only extension/deletion tables
- Backfill required? (yes/no):
  - yes (for existing workforce mappings to canonical IDs)

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed

## Change Log

- 2026-02-25: Created initial draft.
- 2026-03-03: Updated for phase-1 web/backend implementation, including recruited inference event model and active API endpoint mapping.
