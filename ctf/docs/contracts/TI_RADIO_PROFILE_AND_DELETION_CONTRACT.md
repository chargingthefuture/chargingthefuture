# TI Radio — Profile and Deletion Contract

## What this plugin holds about a person

One kind of row, and it is small: a slot they booked to host a discussion. It carries their user id,
the handle printed on the guide, the start time, and what they said the discussion is about.

Nothing about who listened is stored anywhere. The listening happens in Chyme, which keeps its own
records under its own contract; TI Radio knows only who said they would host and when.

## Deleting an account, or just this service

Both are handled declaratively by the account-deletion engine
(`ctf/packages/web/lib/account/deletion-registry.ts`), which is why there is no bespoke delete
function in `lib/ti-radio/repository.ts`.

| Table | On deletion | Why |
|---|---|---|
| `ti_radio_slots` | Deleted, matched on `host_user_id` | Every row is something that member wrote about themselves. Booked, released and removed rows all go: a released slot is still a record of them having been on the schedule. |
| `ti_radio_admin_audit_trail` | Retained | Records that a command ran — an actor id, a slot id, and a reason — not what was said. An admin removing a slot has to stay answerable for it after the account is gone, which is the point of the row. |

A slot is a booking, not a profile. There is no TI Radio profile to delete, and nothing here is
shown anywhere else in the app.

## What a deleted member leaves behind on the guide

Their slots go, so the times return to the guide as open. A slot in the past disappears with them,
which is correct: the guide is a schedule, not an archive, and it only ever prints the week ahead.
