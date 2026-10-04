# Bug Reporting — Profile and Deletion Contract

## What this plugin holds about a person

One kind of row a member creates: a problem report. It carries their user id, the text they wrote
(raw, and a redacted copy with emails, phone numbers, card-like and token-like strings removed), the
risk flags that redaction raised, the page, plugin and app version they were on, their browser's
user-agent string, the report's status, and, once the outside job has published it, the link to the
issue in the private triage repository.

The second table, `bug_report_admin_audit_trail`, holds nothing a member wrote. It records that an
admin decided a report: the admin's id, the report id, the action, the outcome, and when. It has no
content column and no reporter column.

There is no Bug Reporting profile. A report is shown to admins on `/admin/bug-reports` and nowhere
else in the app; other members never see it.

## Deleting an account, or just this service

Handled declaratively by the account-deletion engine
(`ctf/packages/web/lib/account/deletion-registry.ts`, entry `slug: 'bug-reports'`), which is why
there is no bespoke delete function in `lib/bug-reports/repository.ts`. Reports reference any plugin,
so there is no per-service scope (`serviceScopeSupported: false`): the rows are handled only with the
account.

| Table | On deletion | Why |
|---|---|---|
| `bug_reports` | Pseudonymized: `user_id` is overwritten with the shared placeholder `deleted_member`. No other column is cleared. | A report is operational triage input the owner still needs after the reporter leaves, and it may already be mirrored into a triage-repository issue. The row stays so the bug can still be fixed; the member's id does not, so the row no longer points at anybody. The placeholder is one constant for every departed member, not a per-member token, so deleted members' rows cannot be linked to each other. |
| `bug_report_admin_audit_trail` | Retained | It records what an admin did, not who reported. An admin who released or rejected a report has to stay answerable for that after the reporter's account is gone, and the row carries no reporter id to remove in the first place. |

## What a deleted member leaves behind

Their reports stay on the admin review page under the placeholder id, with the redacted text and the
same status they had. The raw text stays in the row too, because the row is the private source of
truth for the bug and is never published. The reporter display handle on the admin list is derived
from the placeholder, so every departed member's reports read alike there. Anything already
published to the private triage repository was a redacted copy with no reporter identity on it, so
deletion changes nothing there.
