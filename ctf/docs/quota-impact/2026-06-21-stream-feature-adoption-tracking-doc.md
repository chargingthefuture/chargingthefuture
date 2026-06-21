# Stream Quota Impact Note — Stream feature adoption tracking doc

## Summary

- Feature/Change: Adds a planning/tracking document (`ctf/docs/developer/STREAM_FEATURE_ADOPTION.md`) that records which Stream features the app will adopt, the owner's exclusions, and the build task list. No code, schema, contract, or runtime behavior changes.
- PR: #697
- Owner: farah
- Date: 2026-06-21

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: None at runtime. This is a documentation-only change. The Stream Quota Impact gate fires because the doc's path contains the word "stream", not because any Stream usage changed. Each follow-up build PR named in the doc will carry its own quota note with real estimates.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 (no code runs)
- Activity Feed API calls estimate: 0
- Video participant-minutes estimate: 0
- AI Moderation credits estimate: 0

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — no change to consumption.
- Peak scenario estimate: No change; a Markdown file has no runtime cost.

## Fallback and Degradation Plan

- What degrades first: Nothing — there is no runtime path.
- User-visible messaging behavior: Unchanged.
- Kill switch / feature flag: Not applicable (docs only).

## Observability

- Metrics and alerts added/updated: None.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required (docs only).
- Rollback strategy: Revert the doc; no runtime impact either way.
