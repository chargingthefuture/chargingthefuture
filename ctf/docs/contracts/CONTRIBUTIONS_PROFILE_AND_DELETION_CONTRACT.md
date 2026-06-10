# Contributions Profile and Deletion Contract

## 1) Plugin Metadata

- Plugin Name: Contributions
- Service Key (lowercase, stable): `contributions`
- Rollout Stage: Alpha (non-UI foundation; UI is design-gated)

## 2) Canonical Profile Usage

Rule 114 baseline: Contributions uses the single canonical profile and creates no duplicate
identity store. It persists only the canonical `user_id` as a plain reference on the rows it
owns.

- Read fields:
  - `user_id` (to attribute a contribution claim and the banner snooze state to one member,
    and to resolve the admin role for review commands)
- Write fields:
  - none on the canonical profile
- Why canonical fields are needed:
  - tie each contribution claim to the member who made it
  - direct the thank-you ServiceCredits grant to the right wallet
  - keep the per-member banner snooze working across devices

## Identity Handle Baseline

- Fundraiser progress is always shown as collective totals (amount raised, comments,
  stars, contributor count). No member's name, handle, or contribution is ever displayed
  to other members. Only the owner/admin sees who submitted a claim, and only inside the
  review queue.

## 3) Plugin Extension Fields

- Contributions creates no per-user extension table. User linkage lives only as plain
  `user_id` columns on the domain tables below, plus the member-supplied `signal_contact`
  on gift-card claims (see deletion behavior).

## 4) Domain Data Owned by Plugin

- Table/entity: `contributions_cycles`
  - Contains personal data? minimal — `created_by_user_id` (admin user id) only
  - Retention: long-lived fundraiser history (global, owner-managed)
- Table/entity: `contributions_submissions`
  - Contains personal data? yes — `user_id`, and for gift-card claims `signal_contact`
    (the member's own Signal URL or phone number, supplied so the owner can match the
    gift-card code they receive over Signal to the claim). The gift-card CODE itself is
    never collected or stored anywhere.
  - Retention: retained while the account is active; removed on deletion (see below)
- Table/entity: `contributions_runtime_config`
  - Contains personal data? minimal — `updated_by_user_id` (admin user id) only (global
    singleton; `signal_instructions` is owner-authored copy, not member data)
- Table/entity: `contributions_banner_state`
  - Contains personal data? yes — `user_id` plus snooze timestamps
  - Retention: retained while the account is active; removed on deletion (see below)
- Table/entity: `contributions_audit_log`
  - Contains personal data? yes — actor/target user ids in audit rows. Never contains
    `signal_contact` values or gift-card codes (codes never exist in the system).
  - Retention: long-lived compliance/audit record

## 5) Service-Scoped Deletion Contract

When the user deletes their Contributions data only:

- Delete immediately:
  - all of the user's `contributions_submissions` rows — including the `signal_contact`
    personal data on gift-card claims
  - the user's `contributions_banner_state` row
- Anonymize/pseudonymize: none needed beyond the deletes above (no free-text rows identify
  the member elsewhere in this plugin)
- Retain for compliance/fraud/finance:
  - `contributions_audit_log` rows (they record that reviews/config changes happened; the
    actor/target user linkage in retained audit rows is governed by the platform audit
    retention rules)
  - the financial record of any granted credits, which lives in the ServiceCredits ledger
    and is governed by the
    [SERVICE_CREDITS_PROFILE_AND_DELETION_CONTRACT.md](SERVICE_CREDITS_PROFILE_AND_DELETION_CONTRACT.md)
    (immutable ledger; reclaim + tombstone on full account deletion)
- Never touch (must remain): `contributions_cycles` and `contributions_runtime_config`
  (global, owner-managed; collective cycle totals may drop when confirmed rows are deleted)
- User-facing confirmation text: "Your contribution records, including any Signal contact
  you shared, have been deleted. Thank-you credits you already received stay in your
  wallet."

## 6) Full-Account Deletion Contract

When the user requests full account deletion:

- Additional records removed vs service-scoped deletion: none inside this plugin (the same
  two tables are cleared); the user's ServiceCredits wallet is finalized by that plugin's
  own reclaim + tombstone flow.
- Cross-service dependencies: ServiceCredits ledger retains the immutable grant history
  under its own deletion contract.
- Final expected state: no `contributions_submissions` or `contributions_banner_state`
  rows for the user; audit rows retained per audit retention rules; global cycles/config
  untouched.

## 7) Rejoin/Re-enable Behavior

If the user returns after a service-scoped deletion:

- Recreated defaults: nothing is pre-created; the banner state row reappears the first time
  the fundraiser banner is shown, and new claims start from a clean history.
- Data that is not restored: prior claims, prior Signal contact values, prior snooze state.
- Re-consent required? yes — a new gift-card claim asks for the Signal contact again.

## 8) Audit and Events

- Deletion event schema fields: per the platform account-deletion engine (plugin slug,
  tables touched, row counts, timestamp).
- Event table/path: platform deletion audit (see `lib/account/`); plugin-level actions in
  `contributions_audit_log`.
- Who can trigger deletion: the member (self-service) or the owner on the member's behalf.
- Alerting/monitoring requirement: standard deletion-engine observability; no payloads
  containing `signal_contact`.

## 9) API and UX Surface

- Service delete endpoint: platform account deletion orchestrator (registry-driven; this
  plugin is registered in `lib/account/deletion-registry.ts`).
- Full account delete endpoint (or orchestrator): platform account deletion orchestrator.
- Status model: per the platform orchestrator (`requested`, `processing`, `completed`,
  `failed`).
- User-facing copy reviewed by: owner (pending; copy ships with the design-gated UI).

## 10) Migration and Rollback

- Migration file(s): guarded DDL in `ctf/schema.sql` (CREATE TABLE IF NOT EXISTS plus
  ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS for every column).
- Rollback approach: tables are additive; rollback is dropping the `contributions_*`
  tables (no other plugin reads them).
- Backfill required? no.

## 11) Sign-off Checklist

- [x] Product approved data behavior (owner spec, 2026-06-10)
- [x] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [x] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed (UI is design-gated; not yet built)
