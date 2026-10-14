# ClickLog — Profile and Deletion Contract

## What this plugin holds about a person

Three kinds of row, all written by the member themselves:

- An incident (`click_log_incidents`): their user id, when it was logged, an optional location, an
  optional private note, the problem and scheme tag lists, and whether they chose to share the
  incident's coarse trend data with the owner.
- One preferences row (`click_log_preferences`): their default answer to that sharing question.
- A scheme description (`click_log_scheme_suggestions`): text they typed when they picked the
  catch-all "Not listed" scheme, which the form says is shared with the owner, linked to the
  incident it came with.

The unnamed-scheme alert table (`click_log_unnamed_scheme_alerts`) belongs to the plugin but holds
nothing about a person: a window length, a count and a link to the triage issue the alert opened.

There is no ClickLog profile. Nothing here is shown to another member.

## Deleting an account, or just this service

Both scopes are handled declaratively by the account-deletion engine
(`ctf/packages/web/lib/account/deletion-registry.ts`, slug `click-log`, service-scoped deletion
supported), which is why `lib/click-log/` has no bespoke delete-everything function.

| Table | On deletion | Why |
|---|---|---|
| `click_log_scheme_suggestions` | Deleted, matched on `user_id` | Member text. It is removed first because it points at an incident by id without a foreign key. A description already copied into a private triage issue persists there, the same way a bug report does; the database row and the link to the member are what go. |
| `click_log_incidents` | Deleted, matched on `user_id` | Every row is something the member logged about themselves, shared or not. |
| `click_log_preferences` | Deleted, matched on `user_id` | The member's own setting. |
| `click_log_unnamed_scheme_alerts` | Untouched | Carries no member column, only a count over a window and an issue link. |

## What a deleted member leaves behind in the trend report

The owner's aggregate report is computed live from the rows that exist, so once the incidents are
gone they are no longer counted in any later report. A report image already shared outside the app
is not changed by this: it carried day buckets, coarse areas and counts, never an incident id or a
member identity, so there is nothing in it to take back.

## Coming back

A member who deletes this service and logs an incident later starts from the defaults: sharing with
the owner is off until they turn it on again, and nothing they logged before is restored.
