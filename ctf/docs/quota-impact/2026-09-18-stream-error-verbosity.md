# Stream Quota Impact Note — Stream failures say what failed and why

## Summary

- Feature/Change: every place the app talks to Stream (GetStream) now records the caught error and,
  where a member or admin sees a message, includes Stream's own reason. A new shared helper,
  `ctf/packages/web/lib/shared/stream-error-text.ts`, keeps Stream's message, redacts an `api_key`
  value, and caps the length. Chyme's Back Channel token helper throws Stream's reason instead of
  returning null, so a Stream refusal no longer reads "Stream service is not configured". Channel
  create-then-watch fallbacks name both failures when both fail. Account-deletion Stream cleanups
  record why they failed. The web and native chat panels report a failed connect and show its reason.
- PR: fix/stream-error-verbosity
- Owner: Chyme, Beacon, Foundation, LightHouse, SocketRelay, TrustTransport, Feed, Contributor Access
- Date: 2026-09-18

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: none in volume. No Stream call is added, removed, or
  retried differently. Only what happens after a call fails changes: it is reported to Sentry and the
  runtime log, and the reason reaches the screen.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0.
- Activity Feed API calls estimate: 0.
- Video participant-minutes estimate: 0.
- AI Moderation credits estimate: 0.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged.
- Peak scenario estimate: unchanged. A failing call still fails once; no retry is introduced.

## Fallback and Degradation Plan

- What degrades first: nothing new. Best-effort paths (message fan-out, deletion cleanup, the
  Foundation channel setup) keep their degrade-and-continue behavior; they now record the reason.
- User-visible messaging behavior: a failure line reads "<what failed>: <Stream's reason>" instead of
  a fixed sentence.
- Kill switch / feature flag: none needed; no Stream usage changes.

## Observability

- Metrics and alerts added/updated: new Sentry ops `stream_delete_user` (six plugins),
  `stream_fanout_send` (Chyme, Foundation), `connect_and_watch` (web and native chat panels),
  `audio_room_join` (native Chyme), `channel_create` (Feed), `gated_channel_create`.
- Dashboard link (if available): Sentry, filter by `area` tag.

## Validation

- Tests added for degraded mode: typecheck (web, mobile), eslint, and the rule-137 verbosity gate
  pass; the gate's burn-down list does not grow.
- Rollback strategy: revert the PR; no data or Stream configuration changes to undo.
