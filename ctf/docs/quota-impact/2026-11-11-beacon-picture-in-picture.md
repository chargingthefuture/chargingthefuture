# Beacon Picture in Picture — Stream Quota Impact

## Summary

The Beacon viewer on the web (`components/beacon/beacon-viewer.tsx`) gains picture in picture for
the live broadcast and the last replay: a button under the player, and the browser's own
"enter picture in picture" action, so the video moves to its own small window when the member
leaves the tab where the browser allows it. It moves the video element that is already playing. No
new Stream connection, call, channel, watcher or credential is created.

## Stream Surfaces Affected

The live broadcast's HLS playback, which Stream serves. The player, its address and the hls.js
attach are unchanged; picture in picture shows the same element in another window.

## Estimated Monthly Impact

Close to zero. A viewer who would have stopped watching when they switched tabs may keep watching in
the small window, so HLS viewing minutes can rise by the time those viewers would otherwise have
spent away. Broadcasts are a few a month with few viewers each, so the change is within the margin
the Beacon budget already carries. The replay is a recording file and does not count against
Stream's live viewing.

## Budget Threshold Risk

Low. Picture in picture never starts a stream; it only keeps a video already playing on screen.

## Fallback and Degradation Plan

A browser without picture in picture shows a line saying it cannot, and the player works as before.
If HLS viewing ever nears the plan's limit, the button and the action handler can be removed without
touching playback.

## Observability

Existing Stream usage on the dashboard covers HLS viewing minutes. No new metric is needed.

## Validation

Read the change: no `StreamVideoClient`, token route or call join was added; the button and the
action handler call `requestPictureInPicture` on the existing video element (`call-safety.tsx`).
Web typecheck and lint pass.
