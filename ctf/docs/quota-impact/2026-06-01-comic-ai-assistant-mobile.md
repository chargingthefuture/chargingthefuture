# Stream Quota Impact Note — Comic AI Assistant (@comic) Android parity

## Summary

- Feature/Change: Add the Android surfaces for the comic AI Assistant (@comic): answer and
  "Reviewing for safety" pending cards interleaved into the mobile activity feed, the single-field
  `@comic` composer, the first-use consent sheet, the answer rating row, and the owner Review &
  Correction console. All wired to `/api/comic/*` (Postgres + polling).
- PR: #238
- Owner: chargingthefuture
- Date: 2026-06-01

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: none. The comic feature talks only to `/api/comic/*`
  over Postgres with client polling; it does not mint Stream credentials or call GetStream, and it does
  not use Stream's AI moderation. This note exists because the change edits `FeedStream.tsx` — the
  in-app *activity feed* component whose filename matches the `stream` path check — not GetStream.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change. The comic answer/pending cards render inside the existing feed;
  no Stream chat is created.
- Activity Feed API calls estimate: no change to GetStream. Comic polls `/api/comic/*` (Postgres), not
  a GetStream feed.
- Video participant-minutes estimate: no change.
- AI Moderation credits estimate: no change. Answers route through human review (Rasa is not deployed);
  generation is server-side, with no Stream AI-moderation credits consumed.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green**. No GetStream consumption is
  added by this change.
- Peak scenario estimate: even at peak @comic usage there is no GetStream impact; the load lands on the
  comic Postgres tables and the app's polling, not on the Stream Maker-tier quota.

## Fallback and Degradation Plan

- What degrades first: if `/api/comic/*` is unavailable, the comic cards show their existing pending/
  error state and the composer hint; the rest of the feed is unaffected. There is no Stream dependency
  to degrade.
- User-visible messaging behavior: a non-`@comic` send shows a gentle "add @comic" hint rather than
  posting; when the API is unreachable the pending card and existing error copy are shown.
- Kill switch / feature flag: the interim human-review policy is the control — every answer is held for
  owner review before it reaches the asker; nothing auto-publishes. No new Stream flag is introduced.

## Observability

- Metrics and alerts added/updated: none for Stream (no Stream surface). The comic feature emits its
  existing server-side audit trail for inference and review actions.

## Validation

- Tests added for degraded mode: none added (no Stream path). Manual validation: the mobile comic
  surfaces call `/api/comic/*` with the `x-ctf-csrf: 1` header and poll for review outcomes, matching
  the web build.
- Rollback strategy: revert the PR; the feed renders without the comic cards and the `/api/comic/*`
  surface is simply not called from mobile. No Stream-quota consequence either way.
