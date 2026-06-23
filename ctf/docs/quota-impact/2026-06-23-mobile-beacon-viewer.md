# Stream Quota Impact Note — Android Beacon viewer

## Summary

- Feature/Change: Android (React Native) viewer for the Beacon plugin — public HLS watching plus
  signed-in member live chat. Mirrors the shipped web viewer; admin broadcasting is not on mobile.
- PR: branch `feat/mobile-beacon-viewer` (GitHub issue #712)
- Owner: chargingthefuture
- Date: 2026-06-23

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat** (member live chat for a live Beacon event)
  and, indirectly, **Video** (the broadcast itself is Stream Video, billed by the existing admin
  go-live path — unchanged by this PR). HLS playback by viewers is plain bandwidth/CDN delivery of the
  `.m3u8` playlist; it carries **no** Stream Chat connection and **no** Stream Video participant token.
  No Activity Feeds or AI Moderation impact.

## Estimated Monthly Impact

- Chat MAU impact estimate: a Stream Chat connection is opened only for a **signed-in member who opens
  the viewer while an event is live**. These are already-counted members (they chat elsewhere on web
  and mobile), so net-new monthly active users from this PR are ~zero — it adds connection concurrency
  during a live event, not new unique users. Bounded by concurrent live-event viewers who are signed
  in. Anonymous/public viewers open no chat connection.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none added by this PR. HLS playback is not a Stream Video
  participant; the broadcast's own video minutes are billed by the existing admin broadcast path and
  are unchanged here.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green.** Beacon events are ad hoc and
  infrequent, the chat users are already counted, and viewers watch over HLS (bandwidth/CDN, not Stream
  chat MAU).
- Peak scenario estimate: a single popular live event with many signed-in mobile members chatting at
  once raises concurrent Stream Chat connections for that event's duration. This is the same per-viewer
  cost the web viewer already incurs and ends when the event ends.

## Fallback and Degradation Plan

- What degrades first: the live chat. If the chat-token route returns 503 (Stream unconfigured) or 401
  (not a member), the viewer shows a calm "live chat unavailable" / sign-in panel and **HLS watching
  keeps working**.
- User-visible messaging behavior: anonymous viewers always see a "sign in to chat" prompt and can
  watch; members who cannot get a token see "Live chat is unavailable right now." No crash, no blank
  screen.
- Kill switch / feature flag: the server controls participation — when Stream is unconfigured the
  chat-token route returns 503 and the mobile viewer falls back to watch-only automatically.

## Observability

- Metrics and alerts added/updated: none added in this PR. Beacon's existing server-side Stream usage
  (video minutes, chat token minting) is already covered by the web Beacon observability; the mobile
  viewer calls the same routes.
- Dashboard link (if available): the Stream dashboard usage view for Chat connections and Video minutes
  (owner-held).

## Validation

- Tests added for degraded mode: the viewer is built so that a failed/denied chat token and a missing
  HLS URL each fall back to a calm state without throwing (anonymous watch-only, "starting…" frame).
  Manual on-device verification is required (see PR notes); the HLS player is a native module
  (`expo-video`) that needs an EAS build, so it cannot be exercised in Expo Go.
- Rollback strategy: revert the branch. No schema, no server route, and no contract changed; reverting
  removes only the mobile feature directory, the navigator entry, the `expo-video` dependency, and the
  doc/config updates.
