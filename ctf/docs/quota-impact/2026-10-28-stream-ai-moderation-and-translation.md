# Stream AI moderation on posts, and chat auto-translation

## Summary

New SocketRelay asks, PeerProgramming goals and Commons posts are checked with Stream's moderation
check (`lib/integrations/stream-content-check.ts`, config `se:posts`) before they are saved; a post
Stream answers remove is refused. `stream-moderation-setup.yml` writes the `se:posts` and
`chat:messaging` configs (AI text and AI pictures) and turns on chat auto-translation.

## Stream Surfaces Affected

- Moderation API: one `check` call per new ask, goal or Commons post. Words only; pictures are not
  sent.
- Chat: auto-translation on the app, and the `chat:messaging` moderation config on messaging
  channels (the Weavers channel and the other messaging channels the app keeps).
- Video is not affected.

## Estimated Monthly Impact

One check per post. The app's posting volume is in the hundreds a month, so a few hundred checks.
Translation is charged per translated message on channels where a member reads another language;
the messaging channels carry little traffic.

## Budget Threshold Risk

Low at today's volume. Stream bills AI moderation by checks and translation by characters; both
scale with posts, not with members online. If either grows past the plan's allowance, run the
setup workflow's plan mode to see the configs and turn translation off with one change to
`stream-moderation-setup.mjs`.

## Fallback and Degradation Plan

When Stream is not set up, refuses the call or cannot be reached, the post is saved and the
failure is reported (`moderation` / `stream_content_check`). A member's post never waits on Stream
being up.

## Observability

Failures are reported to Sentry and the server log under area `moderation`. Flagged and removed
items appear in Stream's moderation review queue. The weekly `stream-moderation-setup.yml` check
goes red when either Stream app drifts from the target configs.

## Validation

`stream-moderation-setup.yml` in plan mode reads both configs and the translation setting and
prints what is short. Test cases SR-23, PP-24 and FD-27 cover a refused post and an ordinary one.
