# Stream Quota Impact — Foundation/Lighthouse/SocketRelay/TrustTransport deletion cleanup

Change: `feat: clear Stream chat copy on account deletion for foundation/lighthouse/socket-relay/trust-transport`.
Touches each plugin's `lib/<plugin>/stream.ts`, which is why the Stream quota gate requires this note.

## Summary

On account deletion, each of these four plugins now hard-deletes the member's Stream user
(`<prefix>-<userId>`, with `mark_messages_deleted`) via the shared account-deletion external-cleanup
hook, so the thread-chat messages sent into Stream are removed alongside the Postgres rows. This is a
**deletion** on the Stream side — it removes stored data. It adds no new tokens, participant-minutes,
messages, or sessions.

## Stream Surfaces Affected

- Stream Chat only: the member's Stream user (`foundation-<userId>` / `lighthouse-<userId>` /
  `socket-relay-<userId>` / `trust-transport-<userId>`) and their messages in the plugin's thread
  channels are hard-deleted on deletion.
- One extra server-side `deleteUser` call per plugin per whole-account deletion — a low-frequency,
  user-initiated event.

## Estimated Monthly Impact

Net **negative or zero** on stored Stream data (it deletes content). Request volume: at most one
`deleteUser` per plugin per account deletion — a handful per month at most. No change to
participant-minutes, concurrency, or message throughput.

## Budget Threshold Risk

None. The change cannot increase Maker-tier quota usage; it reduces stored data and adds only rare,
user-initiated delete calls.

## Fallback and Degradation Plan

Best-effort after the Postgres delete commits, via the orchestrator hook: if Stream is unconfigured or
unavailable, each `delete<Plugin>StreamData` returns `false`, the orchestrator logs it (`reportError`,
`op: external_cleanup`) and continues, and the user's deletion still succeeds. Degrades to "Postgres
deleted, Stream copy pending a retry/backfill," never a failed deletion.

## Observability

The orchestrator emits a `reportError` with `op: external_cleanup` and the plugin slug on any cleanup
failure. Stream's dashboard reflects the removed users/messages.

## Validation

`@ctf/web` typecheck + eslint clean; EOF, deletion-registry validator, and test-script drift gates pass.
Stream-side removal is confirmed against the Stream dashboard per each plugin's new deletion test case.
