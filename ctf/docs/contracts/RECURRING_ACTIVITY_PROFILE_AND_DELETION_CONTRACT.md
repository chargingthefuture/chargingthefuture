# Recurring Activity Profile and Deletion Contract (Draft)

## 1) Plugin Metadata

- Plugin Name: Recurring Activity
- Service Key (lowercase, stable): `recurring-activity`
- Owner Team: Community Economy Platform (proposed)
- Rollout Stage: Implemented shell

## 2) Canonical Profile Usage

Rule 114 baseline: Recurring Activity extends the canonical profile by `user_id` and must not create a
separate identity system.

- Read fields:
  - `user_id` (both the owner and the counterparty of an activity)
  - display name (resolved for rendering "with <member>", via the shared username resolver — never stored)
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - attach an ongoing peer activity to two canonical member identities
  - render "with <member>" without the plugin holding its own identity store

## 3) Plugin Extension Fields

Recurring Activity holds no per-user profile extension. It owns only the domain tables below; identity
is always the canonical `user_id`.

## 4) Domain Data Owned by Plugin

- Table/entity: `recurring_activities`
  - Contains personal data? yes — links two members by `user_id`, plus sector/currency/cadence and (for
    ServiceCredits lines only) a declared `sc_value`. No free-text is ever stored (no note field), and a
    fiat line stores NO amount by design.
  - Retention period: while both parties keep the activity and the plugin is enabled.
  - Legal/compliance note: NOT a ledger and NOT a payment record. A fiat line never carries an amount,
    so the platform never holds a summable recurring-fiat-payment total. ServiceCredits values are
    declared figures, never executed transfers, and never touch real balances.
- Table/entity: `recurring_activity_audit_trail`
  - Contains personal data? minimal actor/activity linkage.
  - Retention period: compliance retention window.
  - Legal/compliance note: append-only; coarse metadata only (sector, currency code, cadence, status
    transition), no sensitive raw payload.

## 5) Service-Scoped Deletion Contract

When a user deletes Recurring Activity usage only:

- Delete immediately:
  - `recurring_activities` rows where the user is the `owner_user_id` OR the `counterparty_user_id`.
    (A row records a two-party relationship; removing it on either party's request is the privacy-safe
    default, since neither party can be shown a tie the other has deleted.)
- Anonymize/pseudonymize:
  - none planned; rows are removable without preserving a user-identifiable copy.
- Retain for compliance/fraud/finance:
  - `recurring_activity_audit_trail` with minimal actor/activity linkage and no raw sensitive payload.
- Never touch (must remain):
  - canonical profile/account
  - non-plugin data and the source plugins (LightHouse, Foundation, etc.) the relationship may relate to
- User-facing confirmation text:
  - "Delete your Recurring Activity data only? Your account and other plugin data stay active."

## 6) Full-Account Deletion Contract

When a user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - any remaining `recurring_activities` rows where the user is either party.
- Cross-service dependencies:
  - the full-account orchestrator clears these rows alongside the other plugin deletion jobs.
- Final expected state:
  - no recoverable user-linked recurring-activity rows except policy-required audit artifacts.

## 7) Rejoin/Re-enable Behavior

- Recreated defaults:
  - none; a returning member starts with no recurring activities.
- Data that is not restored:
  - prior activities are not restored.
- Re-consent required? no (each new activity is an explicit, per-activity declaration + counterparty
  confirmation).

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - centralized deletion event table/orchestrator path plus `recurring_activity_audit_trail` for the
    plugin's own mutations.
- Who can trigger deletion:
  - authenticated user (self) for plugin-scoped deletion; full-account orchestrator/system actor.
- Alerting/monitoring requirement:
  - alert on failed deletion or policy/audit write failures.

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/recurring-activity` (planned)
- Full account delete endpoint (or orchestrator):
  - `DELETE /api/account/full-account`
- Primary UX surfaces:
  - the Recurring Activity hub (`/apps/recurring-activity`)
  - contextual "Is this ongoing?" prompts embedded in the plugins where the relationship already exists

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse-order rollback for the two domain tables.
- Backfill required? no.

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed

## Change Log

- 2026-07-04: Created the initial Recurring Activity deletion contract alongside the plugin (issue #885).
