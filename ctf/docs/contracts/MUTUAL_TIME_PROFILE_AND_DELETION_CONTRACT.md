# Mutual Time — Profile and Deletion Contract

## Plugin Metadata

- **Slug:** `mutual-time`
- **Name:** Mutual Time
- **Intent:** A one-link meeting-time picker (spec #1780). An admin creates an event; approved members
  vote on one-hour windows in their own timezone; the app picks the window the most members can make.
- **Platforms:** Web + mobile-responsive only. No Android surface (not on the Chyme keep-list, rule 105).
- **Money:** None. No ServiceCredits are read or moved by any Mutual Time command.

## Canonical Profile Usage

Mutual Time does not create or extend a member profile. It stores no profile fields, no display copy,
and no per-member preferences. A member's only footprint is the votes they cast and (for an admin) the
events they created.

## Plugin Extension Fields

None. There is no `mutual_time_user_extension` table.

## Domain Data Owned by Plugin

| Table | User-scoping column | Deletion action on account/service deletion |
|---|---|---|
| `mutual_time_votes` | `voter_user_id` | **delete** — the member's votes are removed. |
| `mutual_time_events` | `created_by_user_id` | **delete** — events the member created are removed; their `mutual_time_votes` cascade (`ON DELETE CASCADE`). |

Deletion is handled declaratively by the account-deletion engine from
`ctf/packages/web/lib/account/deletion-registry.ts` (the `mutual-time` entry), which the CI validator
`ctf/scripts/check-deletion-registry.mjs` checks against `ctf/schema.sql`. Order is child-before-parent
(votes, then events) so a plain delete respects the foreign key.

Service-scope deletion ("delete just my Mutual Time data") is supported: it removes the member's votes
and any events they created. There is no soft-delete, audit, or money table to retain — Mutual Time
keeps no accountability ledger of its own (command activity is captured only in the application audit
log).

## Privacy Notes

- Individual votes are never exposed publicly. The public read returns only aggregate fields (voter
  count, and after close the winning slot + how many can make it) plus, for a signed-in approved member,
  that member's own picks for hydration.
- Mutual Time exposes no Trust participation signal (see the feature inventory's Trust Signal Coverage
  section — recorded NOT APPLICABLE per rule 132).
