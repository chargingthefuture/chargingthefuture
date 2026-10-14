# Stream Quota Impact Note — Beacon reports an unreadable Stream Video answer

## Summary

- Feature/Change: The host stage shows a refused start-broadcast with the route's reason, and `streamVideoFetch` in `lib/beacon/stream.ts` reports a successful Stream Video answer whose body is not JSON instead of reading it silently as empty. Reporting only.
- PR: #3049
- Owner: Charging The Future
- Date: 2026-10-05

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Video (the response handling of existing calls). No new Stream API calls, calls, users or recordings.

## Estimated Monthly Impact

- Chat MAU impact estimate: none.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none — the same calls are made at the same moments.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged.
- Peak scenario estimate: unchanged.

## Fallback and Degradation Plan

- What degrades first: not applicable; no Stream usage added.
- User-visible messaging behavior: a refused start-broadcast shows its reason on the host stage instead of nothing.
- Kill switch / feature flag: none needed.

## Observability

- Metrics and alerts added/updated: an unreadable success body is reported as op `stream_video_response_parse`, area `beacon`, with the request path and status.
- Dashboard link (if available): not applicable.

## Validation

- Tests added for degraded mode: none; the Beacon manual test script covers a refused start-broadcast.
- Rollback strategy: revert the PR.
