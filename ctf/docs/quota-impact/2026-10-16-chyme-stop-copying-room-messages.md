# Stream Quota Impact Note — Chyme room messages are no longer copied to Stream

## Summary

- Feature/Change: Sending a Chyme room chat message no longer copies it to the room's Stream chat channel. The message is stored in Postgres only, which is what both apps read. The copy step upserted the member's Stream user, set up the channel and sent the message on every send.
- PR: the pull request that closes issue #2732
- Owner: Charging The Future
- Date: 2026-10-16

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat — three server calls per room message (user upsert, channel setup, send) are removed. Room audio, the Back Channel and deletion cleanup are unchanged.

## Estimated Monthly Impact

- Chat MAU impact estimate: none or lower — no member connects to Chat for room messages; the server-side user upsert per send is gone.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none.
- AI Moderation credits estimate: none or lower — no room message reaches Stream to be moderated.
- API calls: three fewer per room message sent.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged or lower.
- Peak scenario estimate: lower; a busy room no longer multiplies sends into Stream calls.

## Fallback and Degradation Plan

- What degrades first: nothing; the Stream copy was not read by either app.
- User-visible messaging behavior: unchanged.
- Kill switch / feature flag: not applicable.

## Observability

- Metrics and alerts added/updated: the `stream_fanout_send` error reports stop, since the step is gone.
- Dashboard link (if available): not applicable.

## Validation

- Tests added for degraded mode: none needed; the Chyme manual test case CH-18 records that a sent message makes no Stream call.
- Rollback strategy: revert the PR.
