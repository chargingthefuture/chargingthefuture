# WhatWorks Profile and Deletion Contract

## 1) Plugin Metadata

- Plugin Name: WhatWorks
- Service Key (lowercase, stable): `what-works`
- Rollout Stage: Implemented shell

## 2) Canonical Profile Usage

Rule 114 baseline: WhatWorks uses the single canonical profile and does not create a duplicate
identity store. It persists only the canonical `user_id` as a foreign reference on the rows it owns.

- Read fields:
  - `user_id` (to resolve the viewer for per-row endorsement state and admin role)
- Write fields:
  - none on the canonical profile
- Why canonical fields are needed:
  - attribute a "this helped me" endorsement to exactly one survivor (dedupe)
  - record who suggested / reviewed a tool for moderation and abuse control only

## Identity Handle Baseline

- WhatWorks never displays the suggester's identity. The "Private to suggest" promise means
  `suggested_by` is stored for moderation only and is excluded from every reader **and** admin
  projection. No `@handle` is rendered anywhere in the plugin.

## 3) Plugin Extension Fields

- WhatWorks creates no per-user extension table. User linkage lives only as plain `user_id`
  columns on the domain tables below.

## 4) Domain Data Owned by Plugin

- Table/entity: `what_works_admin_audit_trail`
  - Contains personal data? minimal (the acting admin's id, and the id of the problem or product acted on) — **never `suggested_by`**, so it holds no survivor identity
  - Retention period: compliance retention window
  - Legal/compliance note: the durable record of every admin decision on What Works, added 2026-08-28. Append-only and **never** removed by a member's service-scoped or full-account deletion — the record of a moderation decision has to outlive the thing it was made about. Deliberately omits the suggester so recording moderation does not reintroduce the identity every projection leaves out.


- Table/entity: `what_works_problems`
  - Contains personal data? minimal — `created_by` (admin user id) only
  - Retention: long-lived community content
- Table/entity: `what_works_products`
  - Contains personal data? yes — `suggested_by` and `reviewed_by` user ids (never displayed)
  - Retention: long-lived community content
- Table/entity: `what_works_endorsements`
  - Contains personal data? yes — `user_id` of the endorsing survivor
  - Retention: retained while the survivor's account is active; removed on deletion (see below)

## 5) Deletion Behavior

WhatWorks is a single shared community list. Tool and problem content is community-owned and is
**retained** when an individual leaves (it continues to help other survivors), but every link
back to the departing survivor is removed or anonymized.

On service-scoped or full profile deletion for `user_id = X`:

- `DELETE FROM what_works_endorsements WHERE user_id = X`
  - 2026-08-02: this line was a promise without an executor — WhatWorks had no entry in the
    account-deletion registry at all, so the deletion engine never ran it. The registry now carries a
    `what-works` entry (endorsements deleted; the curated problem/tool lists retained as community
    content with their review-audit columns), caught by the deletion-coverage gate.
  — removes the survivor's "this helped me" marks; each affected tool's verified count drops by one.
- `UPDATE what_works_products SET suggested_by = NULL WHERE suggested_by = X`
  — anonymizes authorship; the suggested tool stays on the list.
- `UPDATE what_works_products SET reviewed_by = NULL WHERE reviewed_by = X`
  — anonymizes the moderating admin reference.
- `UPDATE what_works_problems SET created_by = NULL WHERE created_by = X`
  — anonymizes the problem author reference.

No WhatWorks row stores free-text that identifies the survivor, so anonymizing the `user_id`
references fully removes the personal linkage while preserving the shared list.

## 6) Cascade Notes

- Deleting a `what_works_problems` row cascades to its `what_works_products` and their
  `what_works_endorsements` (`ON DELETE CASCADE`).
- Deleting a `what_works_products` row cascades to its `what_works_endorsements`.
