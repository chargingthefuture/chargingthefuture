# Stream Quota Impact Note — Stream's webhook address moved to app.lagatos.com

## Summary

- Feature/Change: The "Stream — Guest Listener Setup" workflow (`ctf/scripts/stream-guest-listener-setup.mjs`,
  with the new `ctf/scripts/lib/stream-webhook-address.mjs`) now also sets the address Stream sends
  call events to. Every webhook address on a Stream app that names `/api/beacon/stream-webhook`, or a
  retired chargingthefuture.com host, becomes `https://app.lagatos.com/api/beacon/stream-webhook`.
  The old address on app.chargingthefuture.com no longer resolved, so Stream failed every delivery.
- PR: #3409
- Owner: chargingthefuture
- Date: 2026-11-10

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video, through its webhook deliveries.** The
  script reads the app settings (`getAppSettings`) and, in apply mode, writes `webhook_url` or the
  webhook entries of `event_hooks` (`updateAppSettings`). Both are app-settings calls, not usage.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: **back to the designed level.** While
  deliveries failed, a broadcast from a phone broadcaster app started no public feed and no
  recording, and the Video minute meter got no `call.session_participant_left` credits. With
  deliveries arriving again, those starts happen once per broadcast as designed, and the meter
  counts the minutes that were already being used.
- AI Moderation credits estimate: no change.
- Settings calls: one read per Stream app per run, plus one write when the address has drifted.
  The schedule runs weekly.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged from before the outage.
- Peak scenario estimate: unchanged in kind; no new call, participant or recording type.

## Fallback and Degradation Plan

- What degrades first: if the write fails, the run goes red with Stream's reason and nothing else
  changes. An address pointing at another service is never overwritten.
- User-visible messaging behavior: none; the workflow log names each stored address.
- Kill switch / feature flag: do not run the workflow with mode apply.

## Observability

- Metrics and alerts added/updated: the weekly check run goes red when an address drifts.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: the address logic was run against a fake Stream client for an old
  app-level address, an old event hook, an address already correct, an empty one, and one naming
  another service.
- Rollback strategy: revert PR #3409; the address Stream holds stays whatever apply last wrote.
