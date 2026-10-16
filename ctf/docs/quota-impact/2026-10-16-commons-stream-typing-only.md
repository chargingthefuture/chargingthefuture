# Stream Quota Impact Note — The Feed keeps Stream for the Commons typing indicator only

## Summary

- Feature/Change: Removes the Feed's Stream uses that nothing read: the membership-event channel (`ctf-feed-membership-events`, one channel setup and one custom event per membership event) and the two credential routes for the announcements and questions channels, which had no caller. The Commons home chat and the contributor channel keep their Stream connection for the typing indicator, and now check for new posts every 10 seconds instead of 30 while connected.
- PR: the pull request that follows up issue #2732
- Owner: Charging The Future
- Date: 2026-10-16

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat — fewer server calls (no membership events, no announcements/questions channel setup). The Commons typing connection is unchanged.

## Estimated Monthly Impact

- Chat MAU impact estimate: unchanged — the same members connect to the Commons channel for typing.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none.
- AI Moderation credits estimate: none.
- API calls: two fewer Stream calls per membership event. The 10-second check reads the app's own database, not Stream, so it adds no Stream calls.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged or lower.
- Peak scenario estimate: unchanged.

## Fallback and Degradation Plan

- What degrades first: the typing indicator, as before; posts keep appearing through the 10-second check without Stream.
- User-visible messaging behavior: other members' posts appear within about 10 seconds instead of up to 30.
- Kill switch / feature flag: none added; with Stream unconfigured the Commons already runs on the check alone.

## Observability

- Metrics and alerts added/updated: the `membership_event_channel_create` error reports stop, since the step is gone.
- Dashboard link (if available): not applicable.

## Validation

- Tests added for degraded mode: none; manual test case FD-7c covers typing and the 10-second appearance.
- Rollback strategy: revert the PR.
