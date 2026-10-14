# Stream Quota Impact Note — Direct Line message box grows with the text

## Summary

- Feature/Change: The Stream chat message box (channel and reply thread) in the shared chat panel now grows up to six lines instead of staying one line. Styling only.
- PR: #2640
- Owner: Charging The Future
- Date: 2026-10-03

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat (composer display only). No new Stream API calls, channels, users, or message types.

## Estimated Monthly Impact

- Chat MAU impact estimate: none — no change to who connects to chat.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none.
- AI Moderation credits estimate: none — the same messages are sent as before; only the box they are typed in changed size.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged.
- Peak scenario estimate: unchanged.

## Fallback and Degradation Plan

- What degrades first: not applicable; no Stream usage added.
- User-visible messaging behavior: unchanged except the box size.
- Kill switch / feature flag: none needed; reverting the `grow` and `maxRows` props restores the old box.

## Observability

- Metrics and alerts added/updated: none.
- Dashboard link (if available): not applicable.

## Validation

- Tests added for degraded mode: none; manual test steps FDN-10b and PP-2a cover the box.
- Rollback strategy: revert the PR.
