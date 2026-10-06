# SkillUp — Profile and Deletion Contract

## What this plugin holds about a person

SkillUp is a cohort system with an escrow of ServiceCredits behind it, so it holds two kinds of
member row: the member's own things, and the record of why credits moved.

The member's own things:

- Enrollments (`skill_up_enrollments`): which cohorts they joined and where they got to.
- A trainer profile (`skill_up_trainers`): name, headline, bio and the tracks they offer.
- Achievements they earned (`skill_up_user_achievements`).
- Rate-limit counters (`skill_up_rate_limit_counters`) for enrolling and validating.

The record of why credits moved, which names a member but is not theirs to take away:

- Disbursements from cohort escrow (`skill_up_disbursements`), the disputes over them
  (`skill_up_disputes`, `skill_up_dispute_comments`) and the milestone validations that released
  them (`skill_up_milestone_validations`).
- The audit log of every command (`skill_up_audit_events`).
- The trainer skill audit (`skill_up_trainer_skill_audit`): which Directory skills were added or
  removed around a cohort claim. Nobody approves trainers by hand; the skills on a claimed profile
  are the credential, and the abuse is to add a skill, claim a cohort, then remove it. It holds a
  user id and skill ids, no profile content.

Shared and admin rows name a member only as the admin who acted: cohorts (`skill_up_cohorts`),
auto-cohort proposals (`skill_up_cohort_proposals`), the global auto-cohort settings
(`skill_up_auto_cohort_config`) and their per-term overrides (`skill_up_auto_cohort_term_overrides`).

Credits are a non-fiat internal unit, not money; the ledger these rows explain is the ServiceCredits
ledger, whose own contract says what happens to a wallet.

## Deleting an account, or just this service

Both scopes are handled declaratively by the account-deletion engine
(`ctf/packages/web/lib/account/deletion-registry.ts`, slug `skill-up`, service-scoped deletion
supported).

| Table | On deletion | Why |
|---|---|---|
| `skill_up_enrollments` | Deleted, matched on `user_id` | The member's own enrollments. |
| `skill_up_rate_limit_counters` | Deleted, matched on `user_id` | The member's own counters. |
| `skill_up_trainers` | Deleted, matched on `user_id` | The member's own trainer profile. |
| `skill_up_user_achievements` | Deleted, matched on `user_id` | The member's own achievements. |
| `skill_up_enrollment_milestone_escrows` | Retained, after any deposit still held is returned | Before the enrollments are deleted, every deposit of the member's that ServiceCredits still holds is refunded to the member's own wallet and its row marked `refunded` (`refundHeldDepositsBeforeDataDeletion`, run by the deletion orchestrator for both scopes). The enrollment rows are the only way back to these holds, so without this the credits would stay held for good. The rows are then kept as the record of what each deposit did. |
| `skill_up_audit_events` | Retained | The command audit log. |
| `skill_up_disbursements` | Retained | Why escrow balances moved; kept for ledger integrity, like the ServiceCredits ledger it feeds. |
| `skill_up_disputes`, `skill_up_dispute_comments` | Retained | A dispute and its conversation are the record of a contested credit movement. |
| `skill_up_milestone_validations` | Retained | Part of why cohort credits were released. |
| `skill_up_trainer_skill_audit` | Retained | The integrity trail for cohort claims already made. If deleting the account erased it, deleting would be the cover-up. |
| `skill_up_cohorts`, `skill_up_cohort_proposals` | Retained | Shared rows; the member appears only as the admin who created or decided. |
| `skill_up_auto_cohort_config`, `skill_up_auto_cohort_term_overrides` | Retained | Global settings and the admin audit of who changed them. |

Tables with no member column are not in the registry and are left alone: curriculum items,
milestones, and the achievement catalog. The idempotency
table (`skill_up_command_idempotency`) is not one of them: it is deleted, matched on `actor_id`,
because each row is the stored result of a command the member ran, kept only so a retried request
returns the first answer.

## What a deleted member leaves behind

A cohort they trained keeps its row and its history; the learners in it keep theirs. Credits
already disbursed stay where they were sent. A deposit that was still held comes back to the
member's wallet first; if that refund fails, the deletion stops and can be run again, and a deposit
already returned is not returned twice. A dispute they opened stays open or closed as it was,
because the other party's record of it does not depend on the member still having an account.

## Coming back

A member who deletes this service and returns enrolls from scratch. Nothing is restored, and an
earlier trainer profile has to be written again.
