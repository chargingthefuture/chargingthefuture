# Quora Live Census — Profile and Deletion Contract

## What this plugin holds about a person

Almost nothing about a member, and a fair amount about people who are not members.

Every entry row describes a public Quora account that an admin looked at from outside on a fixed
date: the handle, a profile link, whether the account was still there, which subjects it covers,
what it does (practical help, organizing, a personal account, unclear, or unrelated), a rough
answer count, the last year it was active, an evidence link and free notes. The people behind
those accounts have no account here, were not asked, and cannot see or remove these rows. The
entry table has no user column at all.

The one member-side value is `created_by_user_id` on a run, which records which admin started it.
The audit log records which admin read or exported a run, and which refused requests hit which
endpoint.

Nothing here is a profile. There is no census profile for a member, nothing is shown on any member
screen, and no code path publishes a row.

## Deleting an account, or just this service

Both are handled declaratively by the account-deletion engine
(`ctf/packages/web/lib/account/deletion-registry.ts`, slug `quora-live-census`), which is why there
is no bespoke delete function in `lib/quora-live-census/repository.ts`. The entry is marked
`serviceScopeSupported: false`: this is a research record, not a service a member joins, so there
is no "leave this service" scope and the registry runs only with a full account deletion.

| Table | On deletion | Why |
|---|---|---|
| `quora_live_census_runs` | Retained, `created_by_user_id` kept | The admin's id is a provenance stamp on an observation about people outside the app. Clearing it would erase who made the observation while leaving the observation standing, which is the wrong half to keep, and it matters more if a second coder is ever added, since the reason to record a coder is to be able to compare them. The same treatment as every other admin and reviewer column in the registry. |
| `quora_live_census_entries` | Not registered; untouched | No user column. Every row is about a third party's public account, not a member. The rows cascade from their run (`ON DELETE CASCADE` in `ctf/schema.sql`), but since runs are retained, nothing cascades on account deletion. |
| `quora_live_census_audit_log` | Retained, `actor_user_id` kept | Who read or exported a list of named third parties. An access record that disappears when the accessing account does is not an access record. |

## What a deleted admin leaves behind

Everything. Their runs, the entries in them, and the audit rows naming them all stay, keyed to
their former user id as actor only. That is the intended outcome: the record is about the
observations and who is answerable for making, reading and exporting them, not about the admin as
a member.

## Removing a third party's row

The deletion engine has no path for this, because the subject has no account to delete. An admin
removes an entry by hand through `DELETE /api/quora-live-census/runs/[runId]/entries/[entryId]`,
which is a hard delete with no audit row on success. A handle that was exported before removal is
still in whatever file was downloaded; the audit log records that the export happened, not what
was done with the file afterwards.
