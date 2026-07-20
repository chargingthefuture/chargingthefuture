# Stream Quota Impact — account-deletion external cleanup (Chyme first user)

Change: `feat: external-store cleanup hook for account deletion; wire Chyme Stream cleanup`. Touches
`ctf/packages/web/lib/chyme/stream.ts` (adds `deleteChymeStreamData`), which is why the Stream quota
gate requires this note.

## Summary

On account/service deletion, the app now hard-deletes the member's Stream user (`chyme-<userId>`, with
`mark_messages_deleted`) so the chat messages fanned out to Stream are removed alongside the Postgres
rows. This is a **deletion** on the Stream side — it removes stored data — run from the orchestrator's
new external-cleanup hook (and directly from the bespoke chyme-profile route). It adds no new tokens,
participant-minutes, messages, or sessions.

## Stream Surfaces Affected

- Stream Chat only: the member's Stream user `chyme-<userId>` and their messages in
  `messaging:chyme-main-room` are hard-deleted on deletion. No other surface changes.
- One extra server-side `deleteUser` call per deletion request — a low-frequency, user-initiated event.

## Estimated Monthly Impact

Net **negative or zero** on stored Stream data (it deletes content). Request volume: at most one
`deleteUser` per Chyme deletion — a handful per month at most. No change to participant-minutes,
concurrency, or message throughput (nothing new is sent).

## Budget Threshold Risk

None. The change cannot increase Maker-tier quota usage; it reduces stored data and adds only rare,
user-initiated delete calls.

## Fallback and Degradation Plan

Best-effort after the Postgres delete commits: if Stream is unconfigured or unavailable,
`deleteChymeStreamData` returns `false`, the orchestrator hook (or the route) logs via `reportError`,
and the user's deletion still succeeds. A Stream outage degrades to "Postgres deleted, Stream copy
pending a retry/backfill," never a failed deletion.

## Observability

The chyme-profile route stamps `streamCleared` (`yes`/`no`) on its audit event; the orchestrator path
emits a `reportError` with `op: external_cleanup` and the plugin slug on failure. Stream's dashboard
reflects the removed user/messages.

## Validation

`@ctf/web` typecheck + eslint clean; EOF and test-script drift gates pass. The actual Stream-side
removal is confirmed against the Stream dashboard per manual test case CH-11 in the Chyme test script.
