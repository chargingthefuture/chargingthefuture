# Stream Quota Impact Note — Chyme minute meter, room and guest caps, one guest identity per browser

## Summary

- Feature/Change: The app now measures its own Stream Video use and acts on it. (1) A participant-
  minute meter (`stream_video_usage_daily`) credited from every Chyme presence heartbeat — members,
  signed-out listeners, Back Channel calls — summarized month-to-date against
  `STREAM_VIDEO_MINUTES_BUDGET` (default 333,000, the Maker-tier ceiling) and shown on a new admin
  screen (`/admin/chyme`). (2) Rule 110's bands, in force for the first time: a room cap
  (`CHYME_MAX_PARTICIPANTS`, default 50), a guest cap (`CHYME_MAX_GUEST_LISTENERS`, default 100),
  a member notice from Yellow (70%) up, guest listening and Back Channel paused from Orange (85%)
  up, and the room cap dropping to `CHYME_RED_BAND_MAX_PARTICIPANTS` (default 10) at Red (95%).
  (3) The signed-out listener path no longer mints a Stream guest user per page load: the tap
  mints one identity per browser (`chyme-guest-<cookie id>`), and the listener heartbeats and
  leaves like a member so guests can be counted and capped. (4) The web Join pill follows the
  Stream SDK's calling state instead of being set once on join.
- PR: `feat/chyme-stream-quota-meter-caps-guest-identity`
- Owner: chargingthefuture
- Date: 2026-09-19

Owner question that started it: does one member holding the main room open around the clock, alone,
burn too much of the quota? 1,440 participant-minutes a day, about 43,200 a month, is about 13% of
the ceiling — Green. The code review behind that answer found the guard rails the owner remembered
(quota-driven limiting, a capacity notice) did not exist, and that every public page load created a
Stream user. This change builds them.

## Stream Surfaces Affected

- **Video**: metered, capped, and paused by band. No new Video call is opened; the same calls run
  with the same participants. Two things change how many participant-minutes accrue: the room and
  guest caps bound concurrency, and the Orange/Red pauses remove the optional consumers (guests, Back
  Channel) near the ceiling.
- **Chat (MAU)**: the public room read used to `upsertUser` a fresh `chyme-guest-<random>` on every
  page load; it now touches nothing on Stream. The listen route upserts one `chyme-guest-<id>` per
  browser, on the tap, and the same id on every later tap from that browser. Whether Stream counted
  an upserted-but-never-connected user toward Chat MAU was never confirmed; this removes the
  question rather than answering it.
- Activity Feeds, AI Moderation: no change.

## Estimated Monthly Impact

- Chat MAU impact estimate: **down**, from one candidate user per public page load to one per
  browser that actually taps to listen. At 66 loads a day the old path could reach the 2,000-MAU
  ceiling on page views alone; the new path cannot.
- Activity Feed API calls estimate: no change.
- Video participant-minutes estimate: **bounded for the first time**. Members: at most
  `CHYME_MAX_PARTICIPANTS` concurrent per room (50 × 1,440 = 72,000 minutes a day at a full room
  all day, which the Orange and Red bands would cut before the month ran out). Guests: at most
  `CHYME_MAX_GUEST_LISTENERS` concurrent, and zero from Orange up. The one-member 24/7 sit is
  unchanged at ~43,200 minutes a month (13%). The heartbeats that feed the meter are the existing
  member/Back Channel heartbeats plus one new public heartbeat per listening guest every 35s — a
  database write, not a Stream call.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green**, and now measured rather
  than assumed. The bands are computed from the app's own meter; the admin screen shows the band,
  the percent, and a straight-line projection to month end.
- Peak scenario estimate: a full room (50 members) plus a full guest gallery (100) for an entire day
  is 216,000 minutes — 65% of the month in one day. The Yellow notice would show that evening, the
  Orange pause the next day, and the Red cap the day after; the room stays open for 10 members at
  Red. Lower caps are one Infisical change away (rule 123 documents the keys).

## Fallback and Degradation Plan

- What degrades first: from Orange, guest listening (the unauthenticated, unbounded path) and Back
  Channel calls (a second Stream call per pair). From Red, the room cap drops so the room stays open
  for a few people rather than going dark for everyone. Chat is never touched by the policy.
- User-visible messaging behavior: members see one plain notice under the room (web and Android)
  saying what is tight and what is paused, without numbers; a member at the cap sees "This room is
  full right now (M of M people). Try again in a minute."; a signed-out visitor sees the paused
  reason in place of the listen button. The admin screen carries the numbers.
- Kill switch / feature flag: the four environment keys. `STREAM_VIDEO_MINUTES_BUDGET` set low
  forces Red (room cap 10, guests and Back Channel paused) without a deploy; `CHYME_MAX_GUEST_LISTENERS=1`
  is the narrowest guest gate short of Orange. Demo mode still routes to the staging Stream app
  through `resolveStreamCredentials`, unchanged; the meter does not distinguish the two apps, so a
  recording session credits the same rows (acceptable: it overstates, never understates).

## Observability

- Metrics and alerts added/updated: the meter itself (`stream_video_usage_daily`), the summary
  (`lib/stream-quota/usage.ts`), and the admin screen `/admin/chyme` with copy-as-text. The
  2026-06-01 note's gap ("no app-level metric for Chyme participant-minutes") is closed. No push
  alert at the 70/85/95 transitions yet; the member notice and the admin screen are the signal.
- Dashboard link (if available): `/admin/chyme` in the app. Stream's dashboard stays the bill of
  record; the app's count is an estimate good to one heartbeat interval per participant per session.

## Validation

- Tests added for degraded mode: `lib/stream-quota/policy.test.ts` — the band thresholds, that
  nothing pauses before Orange, that Red keeps the room open for a few people, that the Red cap never
  exceeds the full cap, and that the environment overrides and junk values fall back. Typecheck and
  lint pass on web and mobile. The join refusal, the paused invite, the guest admission under the
  cap, and the cookie round trip are covered by the manual test script (CH-7, CH-20, CH-21, CH-A2).
- Rollback strategy: revert the PR. The two tables are additive (`CREATE TABLE IF NOT EXISTS`) and
  can stay; the room read stops carrying `capacity`/`quota`, the public read goes back to minting a
  guest per load, and the caps disappear. No data migration is involved.
