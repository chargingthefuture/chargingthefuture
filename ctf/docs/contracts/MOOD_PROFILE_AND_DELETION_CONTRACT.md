# Mood Profile and Deletion Contract (Draft)

> **Implemented schema (authoritative, 2026-06-26).** Sections 2–10 below are the
> original planning draft and name tables that never shipped (`mood_user_extension`,
> `mood_entries`, etc.). The shipped v3 Mood plugin stores only:
> - `mood_client_identities` — `pseudonym` (PK) ↔ `user_id` (unique). The only place
>   a check-in is linked to an account. Pseudo-anonymous by design.
> - `mood_submissions` — the check-ins (`pseudonym`, `client_id`, `mood_value`,
>   `note`, `submitted_at`). Rows carry **no** `user_id` (it is stored empty); the
>   account link exists only via the pseudonym in `mood_client_identities`.
>
> **Deletion (service-scope and full-account):** the account-deletion registry
> (`ctf/packages/web/lib/account/deletion-registry.ts`) deletes the user's
> `mood_client_identities` row by `user_id`; every `mood_submissions` row stored
> under that pseudonym is removed by the `mood_submissions.pseudonym` foreign key
> (`ON DELETE CASCADE`). No mood data tied to the user survives. The community
> pulse aggregate reads only `mood_value` + `submitted_at`, so it never exposed
> per-user data in the first place.
>
> Defense-in-depth (2026-08-02): the registry also deletes `mood_submissions`
> directly by `user_id`. This matches nothing today — every v3 row stores
> `user_id` as `''` — and exists so any row that ever carries a real id (a
> legacy import, a write path that forgets the convention) is cleared with the
> account rather than surviving as wellbeing data with a name on it.

## 1) Plugin Metadata

- Plugin Name: Mood
- Service Key (lowercase, stable): `mood`
- Owner Team: Wellbeing Experiences (proposed)
- Rollout Stage: Planning

## 2) Canonical Profile Usage

Rule 114 baseline: Mood uses canonical account identity and stores plugin extension fields by `user_id`.

- Read fields:
  - `user_id`
  - display name
  - locale/timezone
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - owner-scoped mood tracking and access control

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): `mood_user_extension`
- Fields:
  - field name: `user_id`
    - type: uuid
    - nullable/default: non-null, unique, FK to canonical profile
    - purpose: plugin extension ownership key
  - field name: `tracking_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: mood tracking frequency and reminder controls
  - field name: `insight_opt_in`
    - type: boolean
    - nullable/default: default `false`
    - purpose: derived insight feature consent
  - field name: `service_deleted_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: plugin-scoped deletion marker

## 4) Domain Data Owned by Plugin

- Table/entity: `mood_entries`
  - Contains personal data? yes (sensitive wellbeing content)
  - Retention period: user-controlled with policy minimums
  - Legal/compliance note: sensitive category handling required
- Table/entity: `mood_tags`
  - Contains personal data? yes (entry linkage)
  - Retention period: medium-lived
  - Legal/compliance note: contextual metadata
- Table/entity: `mood_insights_cache`
  - Contains personal data? yes (derived summary)
  - Retention period: short-lived recomputable cache
  - Legal/compliance note: avoid raw sensitive payloads
- Table/entity: `mood_deletion_events`
  - Contains personal data? minimal (`user_id`, scope, timestamps)
  - Retention period: compliance retention window
  - Legal/compliance note: Rule 114 deletion audit trail

## 5) Service-Scoped Deletion Contract

When user deletes Mood usage only:

- Delete immediately:
  - `mood_user_extension`
  - user entries, tags, and insights cache
- Anonymize/pseudonymize:
  - none expected; user-owned plugin records are removable
- Retain for compliance/fraud/finance:
  - `mood_deletion_events`
- Never touch (must remain):
  - canonical profile
  - non-Mood plugin data
- User-facing confirmation text:
  - “Delete Mood plugin data only? Your account remains active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - remaining Mood user-scoped records not already removed
- Cross-service dependencies:
  - full-account orchestrator coordinates all plugin deletion completion
- Final expected state:
  - no recoverable user-scoped Mood data except policy-required audit evidence

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - new `mood_user_extension` with default tracking settings
- Data that is not restored:
  - deleted entries/tags/insights history
- Re-consent required? (yes/no):
  - yes (sensitive wellbeing tracking and reminders)

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - `mood_deletion_events`
- Who can trigger deletion:
  - authenticated user (self)
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on deletion failures and unusual error rates

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/mood-profile` (planned)
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
  - reverse-order rollback for Mood-only extension/deletion tables
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
