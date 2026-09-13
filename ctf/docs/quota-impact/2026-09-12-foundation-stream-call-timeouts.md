# Stream Quota Impact Note — Foundation call-path Stream timeouts

## Summary

- Feature/Change: Bound the two Stream Chat calls that `createConnectionThread` makes while its
  Postgres transaction is open — `ensureFoundationStreamChannel` and
  `createFoundationParticipantToken` — to 8 seconds each, via a new `withStreamTimeout` helper in
  `ctf/packages/web/lib/foundation/stream.ts`. Both functions already returned `null` on any Stream
  failure and the caller already created the thread with a synthetic channel id; the bound only makes
  that existing degrade happen promptly rather than never. Without it, a Stream app that does not
  answer holds a pooled database connection for as long as it takes to not answer, and once the pool
  is exhausted nothing in Foundation works. The rest of that change (audit writes that no longer fail
  a committed action, member-facing failure references on eight call-path routes, two reworded error
  strings) touches no Stream code.
- PR: #2369, `fix/foundation-call-failure-reporting`, merged 2026-09-12. This note is the follow-up
  record: the Stream Quota Impact Note gate went red on that PR because the note was missing, and the
  PR was merged before it was added.
- Owner: chargingthefuture
- Date: 2026-09-12

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat only**, and only in how long the caller waits
  for it. No Stream call is added, removed, retried, or moved. The same calls run in the same order
  and the same number of times per "Connect now": two `upsertUser` calls, one channel `create` (or a
  `watch` when the channel already exists), one `addMembers`, plus the single `upsertUser` inside
  `createFoundationParticipantToken`. Token minting (`createToken`) is local and reaches no Stream
  API. No change to Activity Feeds, Video, or AI Moderation.

## Estimated Monthly Impact

- Chat MAU impact estimate: no increase, and a small theoretical decrease. The same members are
  registered in Stream Chat on the same path. When the 8-second bound is reached the request is
  abandoned client-side — the timeout stops the caller waiting, it does not cancel work Stream has
  already started, so a slow call that eventually lands still counts exactly as it did before. The
  only difference is a case where the bound fires and Stream never processed the call at all, which
  registers one fewer user than an unbounded wait would have.
- Activity Feed API calls estimate: no change. Foundation makes none.
- Video participant-minutes estimate: no change. The Foundation call path uses Stream Chat for the
  connection thread; it does not open a Stream Video call here.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green.** No new recurring call, no
  polling, no fan-out, no retry loop. A timed-out attempt degrades to a thread with a synthetic
  channel id and the member continues; nothing re-drives the Stream call, so a failing Stream app
  cannot turn into repeated consumption.
- Peak scenario estimate: unchanged — bounded by how many Foundation connections members open, which
  is itself capped per member by `max_active_threads_per_user` (default 20 open connections).

## Fallback and Degradation Plan

- What degrades first: Stream credentials absent still returns `null` before any network call is
  made. Present-but-rejected credentials, an unreachable app, or now an app that does not answer
  within 8 seconds all land on the same `null`. The connection thread is still created, with a
  synthetic channel id; chat on that thread is what is lost, not the connection.
- User-visible messaging behavior: the member is not shown a Stream failure on this path — the
  connection is created and they continue. The Direct Line token route reads `null` as
  `stream_unavailable`, which is where the "chat is unavailable" answer surfaces. Unrelated failures
  on this path now answer through `failureResponse` with `audience: 'member'`, so the member reads
  plain copy carrying a reference that also appears in the server's error report.
- Kill switch / feature flag: unchanged. Demo-mode sessions still resolve to the separate staging
  Stream app through `resolveStreamCredentials`, so recording sessions draw no production Maker-tier
  quota.

## Observability

- Metrics and alerts added/updated: no new metrics. A timeout arrives at the existing `reportError`
  calls as a `StreamSetupTimeoutError` naming the elapsed limit, under the operations already in
  place — `area: 'foundation'`, `op: 'ensure_stream_channel'` and `op: 'participant_token'`. A Stream
  app that is merely slow is now distinguishable in the error reports from one that rejects the call,
  which it was not before. Stream's own dashboard remains the source of truth for usage.

## Validation

- Tests added for degraded mode: none automated (rule 118 defers automated tests during MVP). The
  degraded paths are covered by the Foundation manual test script, which gained FDN-27 (an unexpected
  failure gives a reference to quote) and FDN-28 (a failed audit write does not report a working call
  as broken) in the same change. The timeout path itself is exercised by pointing the Foundation
  Stream credentials at an app that does not answer: "Connect now" completes, the connection appears,
  chat on it reports unavailable, and the error report carries the timeout.
- Rollback strategy: revert the `withStreamTimeout` wrapping in
  `ctf/packages/web/lib/foundation/stream.ts`. Both functions return to waiting indefinitely on
  Stream while holding a database connection. No schema, contract, or route change is involved, so
  there is nothing to migrate.
