# Stream Quota Impact — Chyme guest listener server-side role

Change: `fix: enforce Chyme guest listen-only server-side via Stream call-type role` (code-review
issue #980). Touches `ctf/packages/web/lib/chyme/stream.ts`, which is why the Stream quota gate
requires this note.

## Summary

Guest listeners' Stream user is now created with the role named in the optional
`CHYME_GUEST_STREAM_ROLE` env var (unset = unchanged). Once the owner configures that role on the
`default` Video call type to drop publish capabilities, Stream blocks guests from publishing audio.
This is a permission/role change only — it does not change how many Stream calls are created, how many
tokens are minted, or how long anyone stays connected. There is **no material change to Stream usage**;
if anything it slightly reduces it by preventing a guest from ever publishing an audio track.

## Stream Surfaces Affected

- Stream Video `default` call type, guest (`chyme-guest-…`) identities only, on the single public room
  (`chyme-main-room`). The guest still joins and subscribes to audio exactly as before; only their
  publish grant changes (server-enforced once configured).
- No change to member join/publish, chat, tokens, or any other Stream surface.

## Estimated Monthly Impact

Zero net change. Guest participant-minutes are unchanged (guests already joined and listened before
this change; they still do). Removing publish capability cannot increase usage and may marginally
decrease it (a guest can no longer add an outbound audio track). No new Stream API calls are made —
the same single `upsertUser` + `createToken` per guest as before, now with a `role` field set.

## Budget Threshold Risk

None. This change does not add concurrent participants, calls, minutes, or messages, so it moves the
Maker-tier quota usage by ~0. It reduces the worst-case (a guest publishing audio) rather than adding
to it.

## Fallback and Degradation Plan

The behavior is env-gated. If `CHYME_GUEST_STREAM_ROLE` is unset (or unset later to roll back), guest
tokens revert to the default role and the prior behavior (client-only listen-only enforcement) returns
with no code change. If the Stream role/grants are misconfigured, the safe failure is a guest who
cannot join/hear — the page re-fetches and the listen experience degrades gracefully; members are
unaffected.

## Observability

Guest credential minting and join failures surface through the existing Stream client error paths and
`reportError` in the Chyme stack; Stream's own dashboard shows per-call participant minutes and any
permission-denied publish attempts. No new metric is added by this change.

## Validation

`@ctf/web` typecheck and eslint clean; EOF format check passes. The actual publish block is verified by
the owner after applying the Stream call-type role/grants and setting `CHYME_GUEST_STREAM_ROLE` — see
`ctf/docs/plugins/chyme/guest-listener-stream-role.md`. The code path is a no-op (unchanged behavior)
until that env var is set, so there is nothing runtime-different to validate before the Stream config.
