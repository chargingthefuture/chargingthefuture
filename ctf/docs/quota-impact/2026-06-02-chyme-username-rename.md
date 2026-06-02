# Stream Quota Impact Note — Chyme username rename

## Summary

- Feature/Change: Chyme now identifies a message/room author by `username` (rendered `@username`) instead of the dropped `display_name` column. The only Stream-related edit is a non-functional rename inside `ctf/packages/web/lib/chyme/stream.ts` (the `displayName` parameter that sets the Stream user `name` is renamed to `name`) and the join route now passes the already-formatted `@username` handle as that same Stream user name.
- PR: #294
- Owner: farahbrunache
- Date: 2026-06-02

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: None functionally. Chyme's audio room uses Stream Video; this change does not add, remove, or alter any Stream call — it only changes what string is used as the Stream user's display `name` (now `@username` instead of the identical value previously stored in `display_name`). No new users, channels, calls, or API calls are introduced.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 (no change in who connects to Stream).
- Activity Feed API calls estimate: 0 (no feed calls changed).
- Video participant-minutes estimate: 0 (no change to join behavior or call lifecycle).
- AI Moderation credits estimate: 0 (no moderation calls changed).

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — net-zero change to Stream usage.
- Peak scenario estimate: Unchanged from current Chyme behavior; this PR cannot increase Stream consumption because it adds no Stream operations.

## Fallback and Degradation Plan

- What degrades first: Unchanged from existing Chyme behavior; no new dependency is added by this PR.
- User-visible messaging behavior: The Stream display name shows `@username` (previously the identical stored value); fallback to `user-<first 8 of id>` when a username is absent.
- Kill switch / feature flag: Not applicable — no new Stream surface; existing Chyme flags/behavior are unchanged.

## Observability

- Metrics and alerts added/updated: None required — Stream usage is unchanged. Existing Chyme/Stream observability continues to apply.
- Dashboard link (if available): Existing Stream usage dashboard (unchanged).

## Validation

- Tests added for degraded mode: Not applicable — no behavior change to Stream. Web typecheck and lint pass; SQL changes reviewed by hand.
- Rollback strategy: Revert PR #294. Because the change adds no Stream operations, rollback has no Stream-quota consequence.
