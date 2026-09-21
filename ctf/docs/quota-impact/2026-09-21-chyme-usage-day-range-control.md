# Stream Quota Impact Note — Day-range control on the Chyme usage meter

## Summary

- Feature/Change: the day-by-day card on `/admin/chyme` picks its own range (7 days, 30 days, this
  month, all of it) instead of showing a fixed seven days. `readStreamVideoUsageSummary` reads
  every recorded day rather than a fixed 31-day window, and returns `earliestDateIso` with it.
- PR: #2490
- Owner: asked whether the database keeps anything past the seven days the screen showed. It does —
  `stream_video_usage_daily` is never pruned — so the range became a control rather than a constant.
- Date: 2026-09-21

## Stream Surfaces Affected

- **None.** No Stream API is called by this change. The meter reads the app's own table, which is
  written by the presence heartbeats and the participant-left webhook; neither is touched here.
  The Stream dashboard remains the bill of record, as before.
- The Video figures the screen reports are unchanged in value. Only how many days of them are read
  from Postgres and drawn changed.

## Estimated Monthly Impact

- Chat MAU impact estimate: none.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: **zero change.** Nothing here opens, joins, or holds a call.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout: unchanged. The band is computed from the same month-to-date sum
  by `readStreamVideoQuotaBand`, which this change does not touch.
- Peak scenario estimate: unchanged.
- The one cost that moved is a Postgres read on an admin-only screen. The day query dropped its
  `usage_date >= today - INTERVAL '30 days'` filter, so it now aggregates every row in
  `stream_video_usage_daily`. That table gains one row per day per surface — at a year in, a few
  hundred rows for a grouped scan with no join. The response carries one entry per day, about 365
  at a year, which is a few tens of kilobytes of JSON to a single admin.

## Fallback and Degradation Plan

- What degrades first: nothing new. If the read fails, the route answers 503 with the reason and
  the screen shows it, exactly as before.
- User-visible messaging behavior: unchanged. This screen is admin-only and members never see it.
- Kill switch / feature flag: none needed. The card opens on 7 days, so the screen reads as it did
  until a pill is tapped, and the four ranges are computed from one payload with no extra request.

## Observability

- Metrics and alerts added/updated: none. The meter's own figures, bands, and the
  `STREAM_VIDEO_MINUTES_BUDGET` comparison are unchanged.
- The screen now names the first day the meter recorded anything, so how far the record reaches is
  answerable from the screen rather than from the database.

## Validation

- Tests added for degraded mode: none added. The existing suite passes (396 tests). The zero-fill
  that used to be an inline 31-step loop is now `fillDays`, which walks UTC days from the first
  recorded day to today, so a day with no usage still reads zero and the list has no gaps.
- Manual: CH-A2 in `ctf/docs/developer/test-scripts/chyme-test-script.md` gained two steps covering
  the four ranges and that "Copy as text" pastes the selected one.
- Rollback strategy: revert the PR. Nothing is written, no schema changed, and no Stream state is
  involved, so a revert restores the previous screen with no cleanup.
