# Stream Quota Impact Note — Mobile Hub home wired to the feed-backed channel

## Summary

- Feature/Change: Wire the Android Hub home to the same Feed-backed `community` channel the web Hub
  uses (read `GET /api/commons/messages`, post via `POST /api/commons/messages`). Remove the dead
  GetStream-based `survivor-hub-chat` mobile fixtures (nothing imported them; GetStream was already
  removed from the platform).
- PR: #236
- Owner: chargingthefuture
- Date: 2026-06-01

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: none added. The Hub channel is served by the Feed
  model over Postgres with client polling — it does not mint Stream credentials or call GetStream. The
  only Stream-related touch in this change is the *removal* of the unused
  `fetchSurvivorHubChatStreamCredentials` stub and its mock screen.

## Estimated Monthly Impact

- Chat MAU impact estimate: net **zero to slight reduction**. The removed stub never ran in production
  (nothing imported it); the new Hub home adds no Stream chat MAU.
- Activity Feed API calls estimate: no change to Stream — the Hub stream is the in-app activity feed
  backed by Postgres, not a GetStream feed. Mobile polls the same `GET /api/commons/messages` the web Hub
  already serves.
- Video participant-minutes estimate: no change (no video on this surface).
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green**. This change adds no GetStream
  consumption and removes a dead Stream code path.
- Peak scenario estimate: even at peak Hub usage there is no GetStream impact, because the channel is
  Postgres + polling, not a Stream surface.

## Fallback and Degradation Plan

- What degrades first: if `GET /api/commons/messages` is unavailable, the mobile Hub shows its existing
  empty/error state; there is no Stream dependency to degrade.
- User-visible messaging behavior: posting is disabled and the existing error state is shown when the
  API is unreachable.
- Kill switch / feature flag: the Hub home is the app's home surface; the underlying Feed already has
  its render-config controls. No new Stream flag is introduced.

## Observability

- Metrics and alerts added/updated: none. No new Stream metering is introduced; removing the dead stub
  slightly reduces the Stream surface area that has to be reasoned about.

## Validation

- Tests added for degraded mode: none added (no Stream path here). Manual validation: the mobile Hub
  reads and posts against `/api/commons/messages` with the `x-ctf-csrf: 1` header, matching the web Hub.
- Rollback strategy: revert the PR; the previous mobile home (and the now-removed dead stub) are
  restored, with no Stream-quota consequence either way.
