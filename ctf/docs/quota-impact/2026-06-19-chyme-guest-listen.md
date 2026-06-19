# Stream Quota Impact Note

## Summary

- Feature/Change: Let signed-out visitors LISTEN to the one default Chyme room when it is live.
  Chyme's promise is "free to listen, sign in to speak", but every room was members-only so a guest
  could never actually listen. This adds a public, unauthenticated endpoint that — only when the room
  is live — mints an ephemeral guest Stream identity and connects it to the same call as a
  receive-only listener (camera and microphone disabled, no speak/raise-hand controls).
- PR: feat/chyme-public-listen
- Owner: platform
- Date: 2026-06-19

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video** (Chyme audio rooms run on Stream Video).
  Guests connect to the existing call and consume audio. No new chat, feed, or moderation usage. A
  guest identity is upserted via the Stream chat client only to mint the token; guests do not use chat.

## Estimated Monthly Impact

- Chat MAU impact estimate: Negligible. Guest identities are ephemeral (`chyme-guest-<uuid>`) and are
  created only to mint a token; they are not real chat members.
- Activity Feed API calls estimate: 0.
- Video participant-minutes estimate: **This is the real cost.** Each guest who listens counts as a
  Stream Video participant for the minutes they stay connected, on top of the signed-in speakers.
  Bounded by how often the single default room is live and how many guests listen at once. Guests
  only ever connect while the room is actually live (the endpoint returns no credentials otherwise),
  so an idle/empty room incurs zero guest minutes.
- AI Moderation credits estimate: 0.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Yellow.** With one room and a small
  community this is low, but public listening is unauthenticated, so guest minutes scale with anyone
  on the internet who opens the page while a room is live.
- Peak scenario estimate: A popular live room shared publicly could draw many simultaneous guest
  listeners, each accruing participant-minutes for the duration. If this becomes material, gate guest
  listening behind a cap (max concurrent guests) or a feature flag.

## Fallback and Degradation Plan

- What degrades first: If Stream is not configured, the public endpoint returns `isLive` without
  credentials and the guest shell shows the existing "sign in" view — no connection is attempted.
- User-visible messaging behavior: When the room is not live, guests see the current "no public rooms
  streaming / sign in" view. When live, they see a "Listening live" indicator and a "sign in to speak"
  prompt. Guests can never publish audio (mic disabled, no controls).
- Kill switch / feature flag: None added yet. The simplest off switch is to stop returning guest
  credentials from `/api/chyme/public/room` (or unset Stream credentials). A concurrency cap or flag
  can be added if guest minutes become a budget concern.

## Observability

- Metrics and alerts added/updated: None added. Failed guest joins are reported via `reportError`
  (area `chyme`, op `guest_listen_join`); the public route reports under op `public_room`.
- Dashboard link (if available): n/a. Watch Stream Video participant-minutes in the Stream dashboard.

## Validation

- Tests added for degraded mode: Manual. The endpoint only returns credentials when the room is live;
  the guest client joins with `create: false` and disables camera + microphone, so a guest cannot
  start a call or publish audio. Web typecheck + lint pass.
- Rollback strategy: Revert the PR. No schema or data changes are involved (the default room is
  treated as the public one by its existing key; no new columns), so rollback is code-only.

## Known limitation (for review)

- Listen-only is enforced on the client (mic disabled, no controls). A determined guest holding a
  token could attempt to publish unless the Stream call type's roles forbid it. If server-side
  enforcement is required, configure the `default` call type so guest/anonymous roles cannot publish.
