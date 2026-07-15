# Stream Quota Impact Note — Questions chat lifecycle and route shape hardening

## Summary

- Feature/Change: Code-review fixes to the Feed "Questions" Stream chat. The mobile screen now awaits `connectUser` before rendering the channel, catches connection errors, and disconnects the real client on unmount (via a ref) instead of leaking it; the web `POST /api/questions/stream` route returns the four `stream*` credential fields explicitly instead of spreading the credentials object. No new Stream surface, channel, or usage pattern is introduced.
- PR: chargingthefuture/chargingthefuture#1514
- Owner: chargingthefuture
- Date: 2026-07-14

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat only** — the existing `ctf-feed-questions` chat channel used by the mobile Questions screen. No feed, video, or moderation surface is touched.

## Estimated Monthly Impact

- Chat MAU impact estimate: **None (net neutral, likely a small reduction).** The change does not add users, channels, or messages. It fixes a lifecycle bug where the authenticated Stream WebSocket was never torn down on unmount, so if anything it reduces the number of simultaneously-open connections per member rather than increasing usage.
- Activity Feed API calls estimate: No change (surface not used here).
- Video participant-minutes estimate: No change (surface not used here).
- AI Moderation credits estimate: No change (surface not used here).

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green** — unchanged from before this PR.
- Peak scenario estimate: No increase. The same one chat channel is connected per active Questions viewer; the fix only ensures each connection is properly closed and correctly established.

## Fallback and Degradation Plan

- What degrades first: Unchanged — if Stream is unconfigured or credentials cannot be minted, the route returns 503 and the screen shows an error, exactly as before. With this fix a `connectUser` failure now also surfaces an error state instead of rendering a broken, unconnected client.
- User-visible messaging behavior: On any credentials or connection failure the Questions screen shows an inline error message rather than a blank or broken chat.
- Kill switch / feature flag: Governed by the existing Stream configuration (credentials absent ⇒ route returns 503 and the surface is unavailable). No new flag added.

## Observability

- Metrics and alerts added/updated: None added. Server-side errors continue to flow through `reportError` (area `feed`, op `questions_stream`); the shared Stream budget monitoring is unchanged.
- Dashboard link (if available): Existing Stream usage dashboard; no new panel required.

## Validation

- Tests added for degraded mode: No automated tests added (the manual Feed/Questions test flow is unchanged). Web and mobile typecheck, web lint, and the web production build pass; verified the connect/await/disconnect ordering and the explicit route response shape by inspection.
- Rollback strategy: Revert the PR. The change is behavior-only on an existing surface with no schema or contract change, so a revert restores the prior behavior with no data migration.
