# Stream Quota Impact Note — Private "Weavers of the Commons" Chyme room

## Summary

- Feature/Change: A second, contributor-gated Chyme audio room (`chyme-contributors-room`) alongside the existing single main room. It reuses the exact Stream surfaces the main room already uses (one `messaging` chat channel per room + `default` Video call), just for a second room key.
- PR: #1853
- Owner: farahbrunache
- Date: 2026-07-23

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat** (one additional `messaging` channel, id `chyme-contributors-room`) and **Video** (one additional `default` audio-only call, same call id). No Activity Feeds and no AI Moderation surfaces are touched. No new Stream user identities are minted — the private room reuses each member's existing `chyme-<userId>` Stream user, so Chat MAU is unchanged.

## Estimated Monthly Impact

- Chat MAU impact estimate: **~0 net new MAU.** The same members already count as Chat MAU from the main room; joining the private room reuses the same Stream user id, so a member active in both rooms is still one MAU. Only a member who is active *exclusively* in the private room (never the main room) would be a new MAU — a small subset of the small contributor-eligible cohort.
- Activity Feed API calls estimate: 0 (no feeds).
- Video participant-minutes estimate: additive only while contributors are actually in a live private call — a strict subset of the (small) contributor cohort, one room, audio-only. Expected to be a rounding-error fraction of main-room minutes; there is no new always-on call.
- AI Moderation credits estimate: 0 (not used).

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green.** The audience is capped at contributor-eligible members (a small, slow-growing set gated by the channel-open switch), the room is audio+chat only, and it adds no new Stream identities.
- Peak scenario estimate: every eligible member simultaneously in the private call — still bounded by the eligible-member count and one room's worth of participant-minutes, on top of (not multiplying) main-room usage.

## Fallback and Degradation Plan

- What degrades first: Stream Video (audio). If Stream is unconfigured or a token mint fails, `createStreamJoinCredentials` returns null and the join route returns 503 (`CHYME_STREAM_UNAVAILABLE`) — identical to the main room's existing behavior. WebRTC-less browsers get the existing "live audio isn't available" message; room chat still works.
- User-visible messaging behavior: same as the main room — a clear "Stream service is not configured" / "connecting…" state, never a crash.
- Kill switch / feature flag: the contributor **channel-open switch** (`contributor_access_config.channel_open`) gates the whole private room. Turning it off closes the room for all non-admins immediately (they get the "how it's earned" explainer), which also stops all private-room Stream usage.

## Observability

- Metrics and alerts added/updated: none new. Private-room joins/messages/leaves emit the existing Chyme audit commands (`chyme.call.join`, `chyme.message.send`, `chyme.hand`, etc.) with the room key in the audit target, so private-room activity is already distinguishable in the audit stream by `roomKey = chyme-contributors-room`. Stream-side usage rolls up into the existing Stream dashboard for the app.
- Dashboard link (if available): existing Stream app dashboard (no new dashboard).

## Validation

- Tests added for degraded mode: manual test script step **CH-17** (Chyme) covers the gated join, the non-eligible explainer, and channel-closed behavior; the 503/unsupported paths are the main room's existing CH-8 behavior, unchanged. `@ctf/web` typecheck, lint, a11y, and production build pass.
- Rollback strategy: revert the PR (no schema change — the second room is a runtime `chyme_rooms` row, so there is no migration to unwind) or set `channel_open = false` to close the room without a deploy.
