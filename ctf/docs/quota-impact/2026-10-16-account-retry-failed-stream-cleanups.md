# Stream Quota Impact Note — Failed Stream cleanups after a deletion are retried hourly

## Summary

- Feature/Change: When a plugin's Stream cleanup fails after an account or service deletion, the failure is recorded and an hourly job tries it again (one `deleteUser` call per due row), with a growing wait and at most 12 attempts. The seven Stream delete helpers also treat Stream's "does not exist" answer as done, so a member who never opened a plugin no longer produces a failed call that is reported.
- PR: see the pull request for issue #2703
- Owner: Charging The Future
- Date: 2026-10-16

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only — `deleteUser` with `mark_messages_deleted` and `hard_delete`, the same call the deletion already makes. No new channels, users or message types.

## Estimated Monthly Impact

- Chat MAU impact estimate: none — no user connects; these are server calls for deleted accounts.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none.
- AI Moderation credits estimate: none.
- API calls: at most one `deleteUser` per failed cleanup per attempt, 12 attempts at most over about four days, and at most 50 per hourly run. With Stream healthy, failures are rare and this is zero.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged.
- Peak scenario estimate: a Stream outage during many deletions queues one row per account and plugin; the hourly batch of 50 bounds the calls once Stream returns.

## Fallback and Degradation Plan

- What degrades first: the retry. If Stream is still failing, a row waits longer and is given up on after 12 attempts, and the job summary counts the given-up rows.
- User-visible messaging behavior: none; deletions already show as complete.
- Kill switch / feature flag: disable the `account-external-cleanup-retry.yml` workflow.

## Observability

- Metrics and alerts added/updated: the job summary records `tried`, `cleared`, `stillFailing`, `gaveUp` and `givenUpTotal` for production and demo; a failed record write reports as op `external_cleanup_record_failure`, a demo-schema read failure as `external_cleanup_retry_demo`.
- Dashboard link (if available): not applicable.

## Validation

- Tests added for degraded mode: `lib/account/external-cleanup-retries.test.ts` (wait schedule, not-found detection); manual test case AD-8.
- Rollback strategy: revert the PR; the table can stay empty.
