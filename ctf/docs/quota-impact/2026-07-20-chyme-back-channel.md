# Quota Impact — Chyme Back Channel (free 1:1 audio sidebar)

## Summary

Back Channel (spec #1746, PR #1781) adds a free 1:1 audio call between two members who are already in
the same live Chyme room. Each accepted call is a **new Stream Video call** (`default` call type,
audio-only, id `back-channel-<callId>`), separate from the main room call. It reuses each member's
existing Chyme Stream identity (`chyme-<userId>`) — no new Stream users are created. This is net-new
Stream Video minutes, bounded by the small population that can start one (only members already in the
one live room, one live call per pair per direction).

## Stream Surfaces Affected

- **Stream Video (new):** a 1:1 audio-only call per accepted Back Channel. Tokens are minted on
  `accept`/`join` via `createChymeBackChannelCredentials` (Stream Chat `createToken`, same mechanism as
  the room join token). No video is ever published (camera disabled on join).
- **Stream Chat:** unchanged. Back Channel has no chat/messaging component.
- No change to the main Chyme room call, guest listen path, or Foundation.

## Estimated Monthly Impact

- **Driver:** participant-minutes of 1:1 audio calls. Upper bound is tiny: Back Channel can only be
  started between two members who are *both* currently in the single live Chyme room, and there is at
  most one live call per initiator→recipient direction. Realistic near-term usage is a handful of short
  calls per active room session.
- **Order of magnitude:** if N back-channel calls of ~M minutes happen per month with 2 participants
  each, that is `2 · N · M` Stream Video participant-minutes. For early usage (N in the low tens, M a
  few minutes) this is a few hundred participant-minutes/month — small next to the main room's
  continuous audio. Calls are reaped ~90s after both apps stop heart-beating, so an abandoned call
  cannot accrue minutes indefinitely.

## Budget Threshold Risk

Low. Usage is gated by live-room co-presence and self-limiting (one live call per pair per direction;
server-side reaping of stale invites at ~45s and stale calls at ~90s). There is no mechanism for a
single member to open many concurrent Back Channel calls. If Chyme room usage grows substantially,
revisit this note with real Stream Video dashboards.

## Fallback and Degradation Plan

- If Stream is not configured, `accept`/`join` return `503` (`CHYME_STREAM_UNAVAILABLE`) and the call
  simply does not start — the rest of Chyme is unaffected. No partial state is left (the row stays
  `active` only while heart-beating and is reaped otherwise).
- Demo mode uses the `*_STAGING` Stream credentials, so recording sessions never touch the production
  Stream Video quota (same selection as the room).

## Observability

Existing Stream Video usage dashboards cover the new 1:1 calls. Server audit events
(`chyme.back-channel.{invite,accept,join,decline,leave}`) provide call-lifecycle counts without any
Stream call needed. A rise in Back Channel accepts is the leading signal for added Video minutes.

## Validation

- `@ctf/web` and `@ctf/mobile` typecheck and lint clean; EOF, inventory-drift, test-script-drift,
  web/android parity, and schema-drift gates pass.
- On-device check (real EAS build) that a backgrounded Back Channel keeps audio is a required release
  gate — Android app test script AN-BC, Chyme test script CH-16 (same class as the room's AN-4 / CH-10).
