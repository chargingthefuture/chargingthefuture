# Stream Quota Impact — Chyme deletion clears the Stream copy

Change: `fix: delete member's Stream copy on Chyme profile/account deletion (privacy)`. Touches
`ctf/packages/web/lib/chyme/stream.ts`, which is why the Stream quota gate requires this note.

## Summary

On Chyme profile/account deletion, the app now calls Stream's `deleteUser(chyme-<userId>,
{ mark_messages_deleted: true, hard_delete: true })` so the member's chat messages (which were fanned
out to Stream) are removed alongside the Postgres rows. This is a **deletion** on the Stream side — it
removes stored data. It adds no new calls, tokens, participant-minutes, or messages, and it only runs
on the already-rare account/profile deletion path.

## Stream Surfaces Affected

- Stream Chat: the member's Stream user `chyme-<userId>` and their messages in the
  `messaging:chyme-main-room` channel are hard-deleted on deletion. No other surface changes.
- One extra server-side API call (a `deleteUser`) per deletion request — a low-frequency,
  user-initiated event, not a per-message or per-session cost.

## Estimated Monthly Impact

Net **negative or zero** on stored Stream data (it deletes content). Request volume: at most one
`deleteUser` per Chyme profile/account deletion — a handful per month at most, far below any
meaningful API-rate consideration. No change to participant-minutes, concurrent users, or message
throughput (nothing new is sent).

## Budget Threshold Risk

None. The change cannot increase Maker-tier quota usage; it reduces stored data and adds only rare,
user-initiated delete calls.

## Fallback and Degradation Plan

The Stream delete is best-effort and runs after the Postgres delete commits: if Stream is unconfigured
or unavailable, `deleteChymeStreamData` returns `false`, the outcome is logged (`reportError`) and
stamped on the audit event (`streamCleared: no`), and the user's deletion still succeeds. So a Stream
outage degrades to "Postgres deleted, Stream copy pending a retry/backfill," never a failed deletion.

## Observability

The audit event for each deletion records `streamCleared` (`yes`/`no`); a `no` also emits a
`reportError` with `op: chyme_profile_stream_cleanup` / `full_account_stream_cleanup`. Stream's own
dashboard reflects the removed user/messages.

## Validation

`@ctf/web` typecheck + eslint clean on the changed files; EOF and test-script drift gates pass. The
actual Stream-side removal is confirmed against the Stream dashboard per manual test case CH-11 in
`ctf/docs/developer/test-scripts/chyme-test-script.md`.
