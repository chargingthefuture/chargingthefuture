# Stream Quota Impact Note — Beacon's webhook accepts deliveries from both Stream apps

## Summary

- Feature/Change: `/api/beacon/stream-webhook` checked every delivery against the production secret
  only. Both Stream apps send to it, and an admin in demo mode broadcasts on the demo app, so every
  delivery from that app was refused and a phone broadcast's feed and recording never started. The
  route now checks each app's secret and starts the feed and recording on the app that signed it. It
  also starts them on `ingress.started` and logs `ingress.stopped`, `ingress.error` and refused
  deliveries for an existing Beacon call.
- PR: opened from branch `fix/beacon-webhook-both-stream-apps`.
- Owner: chargingthefuture
- Date: 2026-10-06

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video.** The same two start requests, now made on
  the app that owns the call. No new call, participant or recording.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: **the demo app's HLS and recording minutes
  rise from zero to one feed and one recording per demo broadcast**, as designed. Production is
  unchanged: its deliveries already passed the check. `ingress.started` adds at most one more start
  request per broadcast, answered "already running" when the join event got there first.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): production unchanged; the demo app gets
  the minutes demo broadcasts were meant to use, which is why demo mode has its own app.
- Peak scenario estimate: unchanged in kind.

## Fallback and Degradation Plan

- What degrades first: a delivery matching neither secret is still refused (401). A failed start is
  logged with Stream's reason and acknowledged.
- User-visible messaging behavior: the event's Log names the Stream app and any refusal.
- Kill switch / feature flag: ending the event (`stop_live`) stops HLS and recording.

## Observability

- Metrics and alerts added/updated: none. Refusals and starts appear in the event's Log.

## Validation

- Tests added for degraded mode: none automated. Type check, lint, Beacon tests and the build pass.
- Manual check: BCN-A2c2 in `ctf/docs/developer/test-scripts/beacon-test-script.md`.
- Rollback strategy: revert the PR. No data migration is involved.
