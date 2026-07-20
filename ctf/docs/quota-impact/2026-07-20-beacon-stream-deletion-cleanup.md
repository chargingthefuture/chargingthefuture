# Stream Quota Impact — Beacon deletion cleanup

Change: `feat: add Beacon to the account-deletion registry + clear its Stream chat copy on deletion`.
Touches `ctf/packages/web/lib/beacon/stream.ts`, which is why the Stream quota gate requires this note.

## Summary

On account deletion, Beacon now hard-deletes the member's Stream user (`beacon-<userId>`, with
`mark_messages_deleted`) via the shared account-deletion external-cleanup hook, so the member's Beacon
live-event chat is removed from Stream alongside the (empty) Postgres footprint. This is a **deletion**
on the Stream side — it removes stored data. It adds no new tokens, participant-minutes, messages, or
sessions.

## Stream Surfaces Affected

- Stream Chat only: the member's Stream user `beacon-<userId>` and their messages in Beacon event chat
  channels are hard-deleted on deletion. Beacon Stream Video (the livestream) is host-published and
  unaffected.
- One extra server-side `deleteUser` call per whole-account deletion — a low-frequency, user-initiated
  event.

## Estimated Monthly Impact

Net **negative or zero** on stored Stream data (it deletes content). At most one `deleteUser` per account
deletion — a handful per month at most. No change to participant-minutes, concurrency, or message
throughput.

## Budget Threshold Risk

None. The change cannot increase Maker-tier quota usage; it reduces stored data and adds only rare,
user-initiated delete calls.

## Fallback and Degradation Plan

Best-effort after the Postgres delete commits, via the orchestrator hook: if Stream is unconfigured or
unavailable, `deleteBeaconStreamData` returns `false`, the orchestrator logs it (`reportError`,
`op: external_cleanup`, slug `beacon`) and continues, and the user's deletion still succeeds. Degrades to
"chat copy pending a retry/backfill," never a failed deletion.

## Observability

The orchestrator emits a `reportError` with `op: external_cleanup` and slug `beacon` on any cleanup
failure. Stream's dashboard reflects the removed user/messages.

## Validation

`@ctf/web` typecheck + eslint clean; EOF, deletion-registry validator (Beacon's two retained tables
validated against schema.sql), and test-script drift gates pass. Stream-side removal is confirmed against
the Stream dashboard per Beacon test case BCN-DEL.
