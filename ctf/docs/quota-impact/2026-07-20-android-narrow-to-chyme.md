# Quota Impact — Narrow the Android app to Chyme (delete deprecated RN code)

## Summary

PR #1742 deletes 29 deprecated React Native feature dirs from the Android app (owner decision,
2026-07-20 — rule 105). Several deleted files were Stream credential fetchers or chat/feed views
(`fetchCommunityStreamCredentials.ts`, `fetchFeedStreamCredentials.ts`,
`fetchLighthouseStreamCredentials.ts`, `fetchQuestionsStreamCredentials.ts`,
`fetchTrustTransportStreamCredentials.ts`, `FeedStream.tsx`, `LighthouseStreamTab.tsx`,
`TrustTransportStreamTab.tsx`, hub `live-stream.ts`, Beacon live views, Foundation instant-call
audio, PeerProgramming session call). No new Stream usage is introduced anywhere in this PR.

## Stream Surfaces Affected

Removed (Android client only — the web equivalents are unchanged):
- Stream Chat: community/feed/questions/lighthouse/trust-transport channel views in the RN app.
- Stream Video: Foundation instant 1:1 call surface and PeerProgramming session call in the RN app,
  Beacon live view.

Kept (unchanged): Chyme audio rooms + Chyme chat panel in the RN app; every web Stream surface.

## Estimated Monthly Impact

Zero or negative. The Android app can no longer open the removed chat channels or place the removed
calls, so Android-originated Stream connections/minutes for those surfaces go to zero. Web usage is
unchanged. No new channels, calls, users, or watchers are created by this PR.

## Budget Threshold Risk

None. Usage only decreases; no path in this PR can add Stream load.

## Fallback and Degradation Plan

Not applicable — no new Stream dependency is added. Members use those features on the web app, whose
existing fallbacks (polling when Stream is not configured) are untouched.

## Observability

Existing Stream usage dashboards continue to cover the remaining surfaces (Chyme, web). A drop in
Android-originated connections for the removed surfaces is the expected signal.

## Validation

- Mobile typecheck/lint pass with the deletions; the Chyme Stream surfaces compile and are unchanged.
- The web build is untouched by the deletions (verified by the web build gate in CI).
- On-device release check: the Chyme room still connects and plays audio (Android app test script,
  steps AN-3/AN-4).
