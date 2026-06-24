# Stream Quota Impact Note — Beacon go-live egress timing fix

## Summary

- Feature/Change: Fix Beacon broadcasts that previously always failed. The "Go live" path asked Stream
  to start HLS and recording at the moment the admin clicked the button, but the in-browser
  screen-share host only mounts after go-live succeeds, so there was no active publisher and Stream
  rejected starting HLS/recording. Now go-live only flips the call out of backstage, and HLS +
  recording are started once — by a new `POST /api/beacon/[id]/start-broadcast` route — when a host
  actually begins publishing media. Net result: broadcasts now run as designed instead of never
  starting.
- PR: not opened (branch `fix/beacon-go-live-egress-timing` pushed for review).
- Owner: chargingthefuture
- Date: 2026-06-24

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video**. This affects when Beacon starts the HLS
  broadcast and the recording on the livestream call. No change to Chat, Activity Feeds, or AI
  Moderation.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change (the event chat channel and its members are unchanged).
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: **unchanged-to-positive.** Before this change,
  the start-HLS/start-recording call always failed, so broadcasts never ran and consumed no HLS or
  recording usage (a broken state, not a saving). After this change, HLS and recording start once per
  broadcast — at the moment a publisher is live — exactly as the feature was designed. The
  `start-broadcast` call replaces the failed go-live egress call; it is not an extra recurring call.
  There is no new polling and no new per-interval traffic: the host posts to `start-broadcast` once per
  share session (guarded so it fires only on the false→true transition of screen-share state).
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green-to-Yellow.** This turns on the
  HLS/recording path that was previously dead. Usage is bounded by Beacon being a single one-way
  livestream at a time (one live event), so HLS distribution and recording scale with broadcast
  duration and viewer count, not with a new background process.
- Peak scenario estimate: a long, well-attended flagship broadcast (HLS distribution to many viewers
  plus one recording) is the peak driver; this is the intended cost of the feature working, not new
  overhead from this change.

## Fallback and Degradation Plan

- What degrades first: if Stream is not configured, `startBeaconBroadcastEgress` returns false and the
  `start-broadcast` route returns 503; the broadcast call still works at the WebRTC level but no public
  HLS/recording starts. The client trigger swallows errors (egress is additive), so a failed
  `start-broadcast` never blocks the host's screen-share.
- User-visible messaging behavior: admin surfaces now show the underlying Stream error text instead of
  a generic message, which makes a real misconfiguration diagnosable. The public viewer stays in its
  starting/idle state until the HLS playlist URL appears.
- Kill switch / feature flag: demo-mode sessions are routed to the dedicated **staging** Stream app via
  `resolveStreamCredentials`, so demo/recording sessions never draw on the production Maker-tier quota.
  To cut HLS/recording quickly, ending the event (`POST /api/beacon/[id]/end`) stops the call, HLS
  distribution, and recording.

## Observability

- Metrics and alerts added/updated: none added in this PR. Both error paths call `reportError` with the
  underlying Stream message (`op: 'go_live'` and `op: 'start_broadcast'`), and the client trigger
  reports failures with `op: 'start_broadcast_client'`, so a failed egress start is now visible in
  error reporting rather than swallowed silently. Stream's own dashboard remains the source of truth for
  HLS/recording usage.

## Validation

- Tests added for degraded mode: none automated. The degraded path is the false-return branch in
  `startBeaconBroadcastEgress` (Stream unconfigured → 503) and the swallowed client error in the
  screen-share trigger. Typecheck and lint pass for the changed files.
- Rollback strategy: revert the branch. Beacon returns to its prior state — go-live again tries to start
  HLS/recording with no publisher and broadcasts fail to start. No data migration is involved.
