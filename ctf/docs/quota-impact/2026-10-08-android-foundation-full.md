# Stream Quota Impact Note — all of Foundation in the Android app

## Summary

- Feature/Change: the Android app carries all of Foundation, copied from the web: Browse, a
  provider's profile, the Offer and Quotes tabs, the Direct Line chat, and the instant 1:1 calls it
  already had (restyled to the web look; the call code is unchanged).
- PR: opened from branch `fix/android-foundation-matches-web`.
- Owner: chargingthefuture
- Date: 2026-10-08

## Stream Surfaces Affected

- Chat: the Direct Line. The app opens the same `messaging` channel the web opens, with credentials
  from the same routes (`POST /api/foundation/connections/threads` after Request Quote, or
  `GET /api/foundation/connections/threads/[threadId]/token` from a quote row), through the shared
  `StreamChatView` the app already uses for Chyme and PeerProgramming. No new channel or channel type.
- Video: no change from 2026-10-06 (audio-only 1:1 instant calls on the same `default` call).
- Activity Feeds / AI Moderation: none.

## Estimated Monthly Impact

- Chat MAU impact estimate: a member who opens a Direct Line in the app is the same Stream user as on
  the web, so a member who used the web before adds nothing. A member who only uses the app and
  opens a Direct Line adds one monthly active user, the same as opening it on the web would.
- Activity Feed API calls estimate: no change.
- Video participant-minutes estimate: no change.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green**. The app moves members
  between surfaces rather than adding new Stream use.
- Peak scenario estimate: the Direct Lines of members who use the app, each one channel watched while
  the screen is open, disconnected when it closes.

## Fallback and Degradation Plan

- What degrades first: when Stream is not configured the thread POST returns no chat credentials, so
  Request Quote lands on the Quotes tab instead of the chat, as on the web; the token route's failure
  is shown in the Direct Line in the route's own words.
- User-visible messaging behavior: "The Direct Line is temporarily unavailable. Try again shortly."
  and the other route messages, the same as the web.
- Kill switch / feature flag: removing the Stream credentials stops the chat on both surfaces.

## Observability

- Metrics and alerts added/updated: none. Chat connect failures are reported through the shared
  `StreamChatView` error report, and a failed token read through `reportError` (`foundation`,
  `direct_line_open`).

## Validation

- Manual: `android-app-test-script.md` section AN-FD, steps 4 and 5 (Request Quote lands in the Direct
  Line, a message reaches the web; Direct Line from a quote row).
