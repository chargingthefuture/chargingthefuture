# Android Pull-to-Refresh Remainder — Stream Quota Impact

## Summary

Adds native pull-to-refresh to the remaining mobile-only Android screens (feed timeline,
announcements, community channel, Hub home, Chyme room list, plus non-Stream screens). Each pull
re-runs the screen's existing REST fetch (`/api/feed/items`, `/api/chyme/...`, the hub message
poll) in a background variant. No new Stream connection, channel, watcher, or credential mint is
introduced anywhere in this change.

## Stream Surfaces Affected

None directly. The touched screens that sit near Stream (Hub home's live layer, the Chyme room
list) refresh through their REST reads only; their Stream connections are created exactly where
and when they were before this change. The live Chyme chat view was deliberately not modified.

## Estimated Monthly Impact

Zero additional Stream usage. A pull-to-refresh triggers member-initiated REST calls against our
own API, which do not count against any Stream quota. Stream connection counts, watch counts, and
credential mints are unchanged.

## Budget Threshold Risk

None. No path that mints Stream credentials or opens a connection runs more often than before;
refresh only re-reads data our own database already serves.

## Fallback and Degradation Plan

Not applicable — if a refresh fetch fails, the screen keeps its last loaded data and the member
can pull again. Stream behavior is untouched, so no Stream-specific fallback is needed.

## Observability

Existing API request logging covers the refreshed REST endpoints. No new Stream metrics are
needed because no Stream call pattern changed.

## Validation

Verified by reading each touched screen's refresh wiring: every `onRefresh` awaits the screen's
existing fetch-based load function; none call `connectUser`, mint Stream credentials, or create
channels. Mobile typecheck and lint pass.
