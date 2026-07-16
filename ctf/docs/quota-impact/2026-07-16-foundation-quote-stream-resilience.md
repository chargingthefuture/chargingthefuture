# Stream Quota Impact Note — Foundation Request Quote resilience when Stream is unavailable

## Summary

- Feature/Change: Server resilience fix in `ctf/packages/web/lib/foundation/stream.ts`. `ensureFoundationStreamChannel` and `createFoundationParticipantToken` now catch a Stream API error, log it via `reportError`, and return `null` — degrading exactly like the existing no-credentials path — instead of throwing and aborting the whole Request Quote transaction. No new Stream surface, channel, user, or message pattern is introduced; the same channel-per-connection model is unchanged.
- PR: chargingthefuture/chargingthefuture#1548
- Owner: chargingthefuture
- Date: 2026-07-16

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat only** — the existing Foundation 1:1 connection thread channel (`foundation-thread-<id>`) created at Request Quote time. No feed, video, or moderation surface is touched.

## Estimated Monthly Impact

- Chat MAU impact estimate: **None (net neutral, slightly lower on failure paths).** The change adds no users, channels, or messages. When Stream is failing it now stops early and returns null instead of letting the error propagate, so if anything it makes marginally fewer Stream calls in the outage case.
- Activity Feed API calls estimate: No change (surface not used here).
- Video participant-minutes estimate: No change (surface not used here).
- AI Moderation credits estimate: No change (surface not used here).

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green** — unchanged from before this PR. The happy path makes the same `upsertUser` / `channel.create`/`watch` / `addMembers` / token calls as before.
- Peak scenario estimate: No increase. One chat channel per Foundation connection thread, exactly as today; the fix only changes what happens when those calls fail (degrade vs. throw).

## Fallback and Degradation Plan

- What degrades first: The Direct Line chat. When Stream is unreachable, thread creation now succeeds with a synthetic channel id and null credentials; the member lands in Quotes rather than hitting a hard error on quote creation. Opening the Direct Line then reports chat unavailable (the token route returns `FOUNDATION_STREAM_UNAVAILABLE`).
- User-visible messaging behavior: Request Quote succeeds and shows the quote in Quotes even during a Stream outage; the "chat unavailable" message is surfaced only when the member tries to open the Direct Line, not on quote creation.
- Kill switch / feature flag: Governed by the existing Stream configuration. In demo mode, chat routes to the staging Stream app (`STREAM_API_KEY_STAGING` / `STREAM_API_SECRET_STAGING`); absent or invalid credentials degrade the chat exactly as above. No new flag added.

## Observability

- Metrics and alerts added/updated: Adds `reportError` logging (area `foundation`, ops `ensure_stream_channel` and `participant_token`) so a Stream failure that was previously swallowed by the generic 503 is now visible with its real cause in Sentry and runtime logs. Shared Stream budget monitoring is unchanged.
- Dashboard link (if available): Existing Stream usage dashboard; no new panel required.

## Validation

- Tests added for degraded mode: No automated tests added; the Foundation manual test script FND-3 gains a Stream-down resilience check. Web typecheck, web lint on the changed file, EOF format, and the test-script drift gate pass.
- Rollback strategy: Revert the PR. Behavior-only change on an existing surface with no schema or contract change, so a revert restores the prior (throw-on-failure) behavior with no data migration.
