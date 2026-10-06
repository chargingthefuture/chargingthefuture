# Stream Quota Impact Note — Beacon chat mute is a timed channel ban; webhook writes its audit row

## Summary

- Feature/Change: The host's mute on a Beacon event chat now calls Stream's channel ban with a 10-minute timeout instead of Stream's personal mute, so the member stops posting to every viewer rather than only to the host. Go-live, start-broadcast and end check the event's status before calling Stream, the chat token is minted only for a live event, and the Stream Video webhook writes its audit row (database only).
- PR: #3042
- Owner: Charging The Future
- Date: 2026-10-05

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat (one ban call replaces one mute call per mute) and Video (go-live is called only for a draft, so a refused go-live makes no Stream call). No new channels, users or message types.

## Estimated Monthly Impact

- Chat MAU impact estimate: none — no change to who connects. A chat token is no longer minted for a draft or ended event, which can only lower it.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none, or lower — an ended event can no longer go live again.
- AI Moderation credits estimate: none, or lower — a muted member's messages no longer reach the channel for ten minutes.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged.
- Peak scenario estimate: unchanged.

## Fallback and Degradation Plan

- What degrades first: the mute. If the ban call fails, the route answers with the failure and nothing else changes for the event.
- User-visible messaging behavior: a muted member's messages are refused for ten minutes for everyone; the ban lifts on its own.
- Kill switch / feature flag: none added; the existing Stream configuration check still applies.

## Observability

- Metrics and alerts added/updated: the webhook writes `beacon.event.stream-webhook.ingest` audit rows (allow on a stored recording, deny on a refused signature); a failed deny write is reported as op `stream_webhook_deny_audit`.
- Dashboard link (if available): not applicable.

## Validation

- Tests added for degraded mode: none; the Beacon manual test script covers mute, go-live on an ended event and the webhook audit.
- Rollback strategy: revert the PR.
