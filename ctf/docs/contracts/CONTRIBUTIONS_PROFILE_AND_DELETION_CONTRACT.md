# Contributions Profile and Deletion Contract

## 1) Plugin Metadata

- Plugin Name: Contributions
- Service Key (lowercase, stable): `contributions`
- Rollout Stage: live on web (Amazon gift cards only, open all year, since 2026-10-27); no Android screen

## 2) Canonical Profile Usage

Rule 114 baseline: Contributions uses the single canonical profile and creates no duplicate
identity store. It persists only the canonical `user_id` as a plain reference on the rows it
owns.

- Read fields:
  - `user_id` (to attribute a gift card claim to one member, to bind the member's id into the
    encryption of their code, and to resolve the admin role for review commands)
- Write fields:
  - none on the canonical profile
- Why canonical fields are needed:
  - tie each claim to the member who sent it
  - direct the thank-you ServiceCredits grant to the right wallet
  - make a stored code readable only on its own member's row

## Identity Handle Baseline

- Nothing about a contribution is shown to other members: no donor list, no totals, no
  progress. Only the admin (the System Architect) sees who sent a claim, and only inside the
  review queue.

## 3) Plugin Extension Fields

- Contributions creates no per-user extension table. User linkage lives only as plain
  `user_id` columns on the domain tables below.

## 4) Domain Data Owned by Plugin

- Table/entity: `contributions_submissions`
  - Contains personal data? yes — `user_id`, the claimed and confirmed amounts, and while a
    claim waits for review, `gift_card_code_encrypted`: the gift card code sealed with
    AES-256-GCM under a key derived from the server-only `CONTRIBUTIONS_CODE_KEY`, with the
    member's account id bound in. The code is erased (set to NULL) in the same statement that
    records the review, whether the claim is confirmed or rejected.
  - Retention: retained while the account is active; removed on deletion (see below)
- Table/entity: `contributions_runtime_config`
  - Contains personal data? minimal — `updated_by_user_id` (admin user id) only (global
    singleton holding credits per dollar and the per-member cap over 365 days)
- Table/entity: `contributions_audit_log`
  - Contains personal data? yes — actor and target user ids in audit rows. Never contains a
    gift card code; the code reveal event records only the claim, the member and whether a
    code was shown.
  - Retention: long-lived compliance/audit record

## 5) Service-Scoped Deletion Contract

When the user deletes their Contributions data only:

- Delete immediately:
  - all of the user's `contributions_submissions` rows, including any encrypted code still
    waiting for review
- Anonymize/pseudonymize: none needed beyond the delete above (no free-text rows identify
  the member elsewhere in this plugin)
- Retain for compliance/fraud/finance:
  - `contributions_audit_log` rows (they record that claims, reviews, code reveals and
    settings changes happened; the actor/target user linkage in retained audit rows is
    governed by the platform audit retention rules)
  - the record of any granted credits, which lives in the ServiceCredits ledger and is
    governed by the
    [SERVICE_CREDITS_PROFILE_AND_DELETION_CONTRACT.md](SERVICE_CREDITS_PROFILE_AND_DELETION_CONTRACT.md)
    (immutable ledger; reclaim + tombstone on full account deletion). The 365-day thank-you cap
    reads those kept grants too, so deleting and sending again does not reset it.
- Never touch (must remain): `contributions_runtime_config` (global settings)
- User-facing confirmation text: the deletion registry's summary, "Your gift card claims,
  including any code still waiting for review (stored encrypted)." Thank-you credits already
  received stay in the wallet.

## 6) Full-Account Deletion Contract

When the user requests full account deletion:

- Additional records removed vs service-scoped deletion: none inside this plugin (the same
  table is cleared); the user's ServiceCredits wallet is finalized by that plugin's own
  reclaim + tombstone flow.
- Cross-service dependencies: ServiceCredits ledger retains the immutable grant history
  under its own deletion contract.
- Final expected state: no `contributions_submissions` rows for the user, so no stored code;
  audit rows retained per audit retention rules; global settings untouched.

## 7) Rejoin/Re-enable Behavior

If the user returns after a service-scoped deletion:

- Recreated defaults: nothing is pre-created; new claims start from a clean history.
- Data that is not restored: prior claims and any code that was waiting for review.
- Re-consent required? no separate consent; sending a new gift card is the member's own act.

## 8) Audit and Events

- Deletion event schema fields: per the platform account-deletion engine (plugin slug,
  tables touched, row counts, timestamp).
- Event table/path: platform deletion audit (see `lib/account/`); plugin-level actions in
  `contributions_audit_log`.
- Who can trigger deletion: the member (self-service) or the owner on the member's behalf.
- Alerting/monitoring requirement: standard deletion-engine observability; no payload ever
  carries a gift card code.

## 9) API and UX Surface

- Service delete endpoint: platform account deletion orchestrator (registry-driven; this
  plugin is registered in `lib/account/deletion-registry.ts` with `serviceScopeSupported: true`:
  delete `contributions_submissions` by `user_id`; retain `contributions_audit_log` and
  `contributions_runtime_config`).
- Full account delete endpoint (or orchestrator): platform account deletion orchestrator.
- Status model: per the platform orchestrator (`requested`, `processing`, `completed`,
  `failed`).
- User-facing copy reviewed by: owner (the registry summary above).

## 10) Migration and Rollback

- Migration file(s): guarded DDL in `ctf/schema.sql` (CREATE TABLE IF NOT EXISTS plus
  ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS for every column), and
  `ctf/db/migrations/post/0075_contributions_gift_cards_only.sql`, which closed pending Quora
  comment and GitHub star claims with a note, dropped `contributions_cycles`,
  `contributions_banner_state` and the Signal, link and drive columns, added
  `gift_card_code_encrypted`, and carried the per-drive cap into `per_user_year_credit_cap`.
- Rollback approach: the dropped tables and columns are not restored; Git history keeps them.
  Dropping the remaining `contributions_*` tables removes the plugin (no other plugin reads
  them).
- Backfill required? no.

## 11) Sign-off Checklist

- [x] Product approved data behavior (owner spec, 2026-06-10; gift cards only, 2026-10-27)
- [x] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion — **Blocked:** the owner is the
      compliance authority and has not yet signed off on how personal data is kept and removed
      here (the encrypted gift card code while a claim waits, and what happens to claims when an
      account is deleted). Do not treat this box as checkable until that review happens.
- [x] Observability added (without sensitive payloads)
- [x] Web and Android parity confirmed (web only; Contributions is not on the Android keep-list, rule 105)
