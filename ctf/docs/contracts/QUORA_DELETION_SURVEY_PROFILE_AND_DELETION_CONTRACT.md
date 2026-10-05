# Quora Account Deletion Survey — Profile and Deletion Contract

## What this plugin holds about a person

Two kinds of row, both written when a signed-in member answers the survey.

A response row carries the member's user id, their yes/no answers, up to two free-text notes, and
three publication consents that default to no. An account row, one per Quora account they
reported, carries the handle they typed, what Quora did to it, the month and year, the reason
Quora gave, whether they appealed, what the account wrote about, and two rough size estimates. The
account rows have no user column of their own; they belong to a response and are reached only
through it.

Most of this is about somebody outside the app: a Quora account that no longer exists. The one
thing that ties it to a member here is the user id on the response row.

Never stored: an IP address, a user agent, an email, or any contact detail. The live Quora profile
link a respondent may name on the confirmation screen is not written to the survey either; it goes
to the Unlock verification queue, which keeps it under its own contract.

## Deleting an account

Handled declaratively by the account-deletion engine
(`ctf/packages/web/lib/account/deletion-registry.ts`, entry `quora-deletion-survey`, run by
`deletion-engine.ts`). There is no bespoke delete function in `lib/quora-deletion-survey/`.
Deleting only this service is not offered (`serviceScopeSupported: false`); the survey is not a
service a member uses, it is a form they answered once.

| Table | On deletion | Why |
|---|---|---|
| `quora_deletion_survey_responses` | Pseudonymized: `user_id` is overwritten with the placeholder `deleted_member`, matched on the member's real id. Every other column stays. | A survey answer is a record of an erasure. Destroying it when its author leaves would repeat the thing the survey exists to document, and would quietly shrink counts already quoted in published posts. The same handling bug reports get, for the same reason. |
| `quora_deletion_survey_accounts` | Untouched by the engine; de-identified with the response. | No user column. The rows reach a person only through `response_id`, and once the response no longer names anyone, neither do they. The `ON DELETE CASCADE` on that foreign key fires only if a response row is ever deleted, which the engine does not do. |
| `quora_deletion_survey_audit_log` | Retained | Records what was done to this data and by whom: admin reads and exports, and verification started from the survey. It has to survive the departure of anyone named in it, like every other accountability trail in the registry. |

The engine writes the string `deleted_member`, not NULL, so every departed member's response
carries the same value and cannot be told apart from another's. The survey code treats that value
as a deleted account: the `repeatRespondents` total leaves those rows out (grouped together, two
departed members who each answered once would have counted as one repeat respondent), the admin
card reads "member account deleted", and the CSV `member_id` cell is empty for them.

## What is written outside these tables

On submission, every handle the member reported as closed is appended to their own Directory
account history (`directory_quora_url_history`) as the marker `removed-quora-account:<handle>`,
with source `quora_deletion_survey`. That history is append-only and is retained on account
deletion under the Directory's own contract; the survey does not write to it again and cannot
remove from it.

A verification started from the confirmation screen creates a pending row in
`unlock_verification_submissions` and a row in `unlock_audit_log`, both handled by the Unlock
contract.

## There is no survey profile

Nothing a respondent wrote is shown to any member, including themselves. There is no edit, no
withdraw, and no member-facing read. The admin reader and the CSV export are the only two ways out
of the table, and what may be published from them is decided by the three consent flags on each
row and by nothing else.
