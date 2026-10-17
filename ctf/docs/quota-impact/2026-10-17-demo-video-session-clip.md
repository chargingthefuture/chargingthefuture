# Stream Quota Impact Note — Demo video Session clip

## Summary

- Feature/Change: the Demo Videos workflow's `peer-programming-session` clip joins the demo account's PeerProgramming call, with a test-pattern camera, for about 20 seconds, and leaves.
- PR: feat/demo-videos-highlights-and-pp-tabs
- Owner: project owner
- Date: 2026-10-17

## Stream Surfaces Affected

- Video only. The demo account is in demo mode, so the call goes to the staging Stream app (`STREAM_API_KEY_STAGING`), never the production one. No product code changes.

## Estimated Monthly Impact

- Chat MAU impact estimate: none.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: about 0.5 participant-minutes per run on staging (one participant, about 20 seconds). The workflow runs only when somebody presses it; even 60 runs a month is about 30 participant-minutes.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green.
- Peak scenario estimate: well under 100 staging participant-minutes a month.

## Fallback and Degradation Plan

- What degrades first: if staging Stream is not configured or refuses the call, the clip fails on its join step and saves `peer-programming-session-failure.png`; the other clips still record.
- User-visible messaging behavior: none for members. The workflow run names the failed step.
- Kill switch / feature flag: run the workflow without the clip (name the other clips instead of `all`), or delete the clip file.

## Observability

- Metrics and alerts added/updated: none; the staging app's own usage page covers it.
- Dashboard link (if available): the Stream dashboard for the staging app.

## Validation

- Tests added for degraded mode: none; a failed join is reported per clip by the recorder.
- Rollback strategy: delete `ctf/scripts/demo-videos/clips/peer-programming-session.mjs`.
