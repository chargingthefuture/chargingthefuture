# Stream Quota Impact Note — Foundation call path: bound the Stream calls held inside a database transaction

## Summary

- Feature/Change: Server resilience fix in `ctf/packages/web/lib/foundation/stream.ts`. `ensureFoundationStreamChannel` and `createFoundationParticipantToken` are now bounded by an 8-second timeout (`STREAM_CHANNEL_SETUP_TIMEOUT_MS`). Both are called from inside `createConnectionThread`'s open Postgres transaction, so an unanswered Stream request held a pooled database connection for as long as Stream took not to answer. Both already degraded to `null` on any failure; the timeout only makes that existing degrade happen promptly. No new Stream surface, channel, user, or message pattern is introduced, and the channel-per-connection model is unchanged. The rest of the PR is error-reporting work on Foundation API routes and touches no Stream call.
- PR: chargingthefuture/chargingthefuture#2369
- Owner: chargingthefuture
- Date: 2026-09-12

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat only** — the existing Foundation 1:1 connection thread channel (`foundation-thread-<id>`) and the per-member chat token minted alongside it. No feed, video, or moderation surface is touched.

## Estimated Monthly Impact

- Chat MAU impact estimate: **None (net neutral, marginally lower on failure paths).** The change adds no users, channels, or messages. The happy path makes exactly the same calls it made before — two `upsertUser`, a `channel.create` or `watch`, an `addMembers`, and a token mint. When Stream is slow or unreachable, the request is abandoned at 8 seconds rather than waiting indefinitely, so an outage now consumes marginally less.
- Activity Feed API calls estimate: No change (surface not used here).
- Video participant-minutes estimate: No change (surface not used here).
- AI Moderation credits estimate: No change (surface not used here).

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green** — unchanged from before this PR.
- Peak scenario estimate: No increase. One chat channel per Foundation connection thread, exactly as today. The timeout can only reduce the work sent to Stream, never add to it. A member whose channel setup times out lands on the existing synthetic-channel-id path, which makes no further Stream calls for that attempt.

## Fallback and Degradation Plan

- What degrades first: The Direct Line chat for that connection. A timed-out channel setup returns `null`, so the thread is still created — with a synthetic channel id and no chat credentials — and the call can still be placed. Opening the Direct Line afterwards reports chat unavailable (the token route answers `FOUNDATION_STREAM_UNAVAILABLE`).
- User-visible messaging behavior: Placing a Foundation call succeeds during a Stream slowdown instead of hanging; the "chat is unavailable" message appears only when the member opens the Direct Line. The 8-second bound means the member waits seconds rather than until the request times out somewhere further up the stack.
- Kill switch / feature flag: Governed by the existing Stream configuration. In demo mode, chat routes to the staging Stream app (`STREAM_API_KEY_STAGING` / `STREAM_API_SECRET_STAGING`); absent or invalid credentials degrade exactly as above. No new flag added, and the timeout constant is a module constant rather than an environment variable so there is nothing new to provision.

## Observability

- Metrics and alerts added/updated: A timeout arrives at the existing `reportError` call as a `StreamSetupTimeoutError` naming the elapsed bound, under the same areas and ops already in use (`foundation` / `ensure_stream_channel`, `foundation` / `participant_token`), so a slow Stream app is now distinguishable in Sentry from one that rejected the call. Elsewhere in this PR, the Foundation call-path routes now attach a short `reference` to every unexpected failure, and that same reference appears in the error report — so a member's screenshot of a failed call can be matched to the log line. Shared Stream budget monitoring is unchanged; no new panel required.
- Dashboard link (if available): Existing Stream usage dashboard.

## Validation

- Tests added for degraded mode: No automated tests added. The Foundation manual test script gains FDN-27 (an unexpected call failure shows a quotable reference and no internal text) and FDN-28 (a failed audit write does not report a working call as broken). Web typecheck, web lint, web build, EOF format, error-verbosity, inventory-drift, test-script-drift, admin-audit-coverage, orphan-routes, unlock-tier, US-spelling and notice-formatting gates all pass locally.
- Rollback strategy: Revert the PR. Behavior-only change on an existing surface with no schema or contract change, so a revert restores the prior unbounded behavior with no data migration.
