# Chyme Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` remains reference-only and must not be modified.
- Unified plugin scope slug: `chyme`
- This document captures the implemented Chyme scope in `ctf/` as of the current rewrite baseline.

## Intent and Outcome

Chyme delivers a lightweight social-audio room with companion text chat, shared-adapter Stream-backed room join flow, provider-neutral access enforcement, and plugin-scoped deletion behavior under the CTF plugin-first architecture.

Lifecycle/governance references applied:

1. Inventory/checklist lifecycle follows `index.mdc` precedence and Rule 120.
2. Profile/deletion boundaries follow Rule 114 and `ctf/docs/contracts/CHYME_PROFILE_AND_DELETION_CONTRACT.md`.
3. Implementation sequencing must honor baseline phase order: auth integration, Railway deployment baseline, Vercel integration, Expo baseline.

## Target User Features (Implementation Scope)

1. Authenticated room bootstrap via `GET /api/chyme/room` with deterministic room provisioning (`chyme-main-room`) and participant upsert.
2. Companion text chat read/send via `GET /api/chyme/messages` and `POST /api/chyme/messages`, with DB persistence and Stream message fan-out through shared adapters.
3. Stream-backed room join/token flow via `POST /api/chyme/join`, using shared Stream wrappers in `packages/shared`.
4. Service-scoped deletion request via `DELETE /api/account/chyme-profile`.
5. Full-account deletion request initiation via `DELETE /api/account/full-account`, including ServiceCredits reclaim dependency queueing in existing reclaim/outbox tables.
6. Web UI surface includes participant list, join-call action, chat panel, and deletion actions.
7. Android UI surface includes room summary, participant roster, chat send/read, join action, and deletion actions using runtime-configured provider-neutral identity headers.

## Target Admin Features

1. No Chyme-specific admin UI is required for MVP unless called by contracts/checklist updates.
2. Eligibility gate must enforce shared access approval model (`approved user` or `admin`) for room/chat/join routes.

## API Surface and Route Map (Target)

Chyme plugin routes:

- `GET /api/chyme/room`
- `GET /api/chyme/messages`
- `POST /api/chyme/messages` — send a chat message. CSRF-guarded (`x-ctf-csrf: '1'` + same-origin).
- `POST /api/chyme/join`
- `POST /api/chyme/heartbeat` — presence keepalive; refreshes the member's `last_seen_at` while in the call. CSRF-guarded.
- `POST /api/chyme/hand` — persists the caller's raise/lower hand on their presence row (`{ raised: boolean }`); returns `{ ok, room }` with refreshed participants. The raised hand stays visible to everyone until lowered, the member leaves, or their presence goes stale. Audit command `chyme.hand`. CSRF-guarded.
- `POST /api/chyme/leave` — drops the member's presence row on exit (which also clears any raised hand). CSRF-guarded.
- `GET /api/chyme/public/room` — **public, unauthenticated.** Returns the one default room's live status (`isLive`, `participantCount`) and, only when it is live and Stream is configured, an ephemeral guest listen-only Stream identity (`credentials`). Lets a signed-out visitor listen ("free to listen, sign in to speak"); guests never publish audio.
- `POST /api/chyme/service-credits` ← `{ toUserId, amount, message? }` → `{ ok, transaction }` — send ServiceCredits from the signed-in member to `toUserId` from the Chyme room (e.g. tipping a speaker). Gated by `requireChymeAccess`; `amount` must be a positive number (else 400). Delegates to `sendServiceCredits` (`lib/chyme/repository.ts`), which uses the shared ServiceCredits transfer primitive — Chyme owns no credits ledger. CSRF-guarded: the handler calls `ensureMutationCsrf` (requires the `x-ctf-csrf: '1'` header + same-origin), matching the sibling plugin service-credits routes (lighthouse / foundation / skills-hunt).

Deletion/account routes (API retained; no longer surfaced in the Chyme UI as of 2026-06-01 — see Delivery Status):

- `DELETE /api/account/chyme-profile`
- `DELETE /api/account/full-account`

Current command-contract note:

- Chyme should be delivered as route + repository flows aligned to plugin command/access/audit contracts.
- Plugin command/access/audit YAML triplet artifacts are present:
  - `ctf/docs/contracts/CHYME_PLUGIN_COMMAND_CONTRACTS.yaml`
  - `ctf/docs/contracts/CHYME_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`
  - `ctf/docs/contracts/CHYME_PLUGIN_AUDIT_CONTRACTS.yaml`

## Data Model and Storage Contracts (Target)

Canonical schema target: Chyme core tables are defined in `ctf/schema.sql`, aligned to route assumptions and schema-drift checks.

1. `chyme_rooms`
   - Shared room metadata (`service_name='chyme'`, `call_active`).
2. `chyme_service_profiles`
   - Plugin extension lifecycle per user (`active|deleted`, timestamps).
3. `chyme_room_members`
   - Membership roster keyed by `(room_id, user_id)`, role enum (`speaker|listener`), last-seen updates, and `hand_raised BOOLEAN NOT NULL DEFAULT FALSE` (persistent raise/lower hand state, set by `POST /api/chyme/hand`, cleared on leave/row deletion). The member is identified by the raw `username` (no separate `display_name` column); the app renders it as `@username`, falling back to `user-<first 8 of user_id>` when the username is null.
4. `chyme_messages`
   - Message history with DB-level text constraint (`1..1000` chars). The author is identified by the raw `username` (no separate `display_name` column); the app renders it as `@username`, falling back to `user-<first 8 of user_id>` when the username is null.
5. `chyme_deletion_events`
   - Service/account deletion event log.
6. `service_credits_account_deletion_reclaims`
   - Downstream reclaim dependency record created when full-account deletion is requested.
7. `service_credits_adapter_outbox`
   - Queue used to hand the reclaim dependency to the existing ServiceCredits execution flow.

## Security, Privacy, and Compliance Controls (Target)

1. Authenticated access is required on Chyme routes; unauthenticated requests are denied (`401`).
2. Access gate enforces approved-user or admin eligibility (`403` for non-approved non-admin users).
3. Identity handle source is the canonical auth-provider username/handle for username/`@mention` semantics, aligned to `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`.
4. Message payloads are trimmed server-side and rejected when empty.
5. Service deletion runs in transaction and records deletion event for audit trail.
6. Full-account endpoint records the Chyme deletion request and queues the downstream ServiceCredits reclaim dependency.
7. Stream integration is routed through shared wrappers/adapters in `ctf/packages/shared`.

## Web and Android Delivery Status

1. Web implementation is delivered for room/chat/join workflows. The account/data deletion API endpoints remain available, but their buttons were removed from the Chyme room UI (2026-06-01) pending a dedicated, designed account-settings surface; deletion is no longer triggered from inside Chyme.
2. Android implementation is delivered for room/chat/join workflows using runtime-configured request identity and the same protected API surface, including the **live audio room** (Stream Video React Native SDK) at parity with the web room. The deletion buttons were likewise removed from `ChymeRoom.tsx`.
3. Current feature-parity status is web+android complete (both platforms are at the same single-room feature level).
4. Web pixel pass: `chyme-live-shell` is aligned to `design/.../survivor-hub/Chyme.tsx`, using lucide-react iconography in place of emoji glyphs. Loading and empty states render inline. The signed-out visitor state is now delivered: `components/chyme/chyme-public-shell.tsx` renders the public view aligned to `design/.../survivor-hub/ChymePublic.tsx` (desktop) and `MobileChymePublic.tsx` (phone width), and the plugin route shows it to anonymous visitors instead of the access-denied wall. The public view is marketing/empty-state content only — it shows no private or per-user data, and because there is no public room-listing endpoint, the room list renders an honest empty state rather than the mockup's placeholder rooms. Its sign-in and join affordances point at the hosted sign-in URL.
5. Android pixel pass: `ChymeRoom.tsx` (and sub-components `chyme-loading`, `chyme-empty`, `chyme-room-list`, `chyme-chat-view`, plus the live `ChymeAudioRoom.tsx`) is aligned to `design/.../survivor-hub/MobileChyme.tsx`, `MobileChymeEmpty.tsx`, `MobileChymeLoading.tsx`. A canonical `api.ts` entry-point was added. All data is bound to real `/api/chyme/*` endpoints. The static in-room stage (`chyme-active-room.tsx`) was replaced by the live `ChymeAudioRoom.tsx` (Stream Video) on 2026-06-08. The public state (`MobileChymePublic.tsx`) is not applicable — Chyme is auth-only per the #102 visibility decision. Delivered 2026-05-31; live audio added 2026-06-08.
6. Scope (MVP): the shipped product is a single shared room (`CHYME_MAIN_KEY` / "Chyme Main Room: Exit the Gauntlet"). The full-featured `Chyme.tsx` design — multiple rooms, room creation ("Start a Room"), discovery, upcoming/scheduled rooms, search, reactions, and speaker-vs-audience promotion with raise-hand — is the accepted design target and is **not yet built**. The pixel passes above aligned the single-room view's styling and iconography to the mockup; they did not implement the mockup's multi-room feature set. See "Gaps and Known Technical Debt".

## Seed Coverage Status

Rule requirement: deterministic plugin seed script for manual validation in dev environments.

Current status:

- Deterministic Chyme seed script is present under `ctf/scripts/seedChyme.mjs`.
- Validation and release evidence live in `ctf/docs/testing/CHYME_FIRST_TEST_PASS.md` and `ctf/docs/quota-impact/2026-04-05-chyme-phase0-remediation.md`.

## Gaps and Known Technical Debt

1. Full-account delete lifecycle remains request-first; terminal orchestrator completion still depends on the broader account-deletion workflow.
2. Chyme-specific admin tooling and moderation controls are out of MVP scope.
3. Live audio is implemented on **both platforms** with the Stream Video SDK: web uses `@stream-io/video-react-sdk` in `components/chyme/chyme-audio-room.tsx`; Android uses `@stream-io/video-react-native-sdk` in `ctf/packages/mobile/src/features/chyme/ChymeAudioRoom.tsx`. Both join the `default` call type audio-only, start muted, support real microphone mute/unmute, show live speaking/mute indicators per participant, let you hear other participants, broadcast a raise-hand Stream reaction, and leave on exit — using the SAME Stream user token (the chat token also grants Video). Requirement: the Stream app used by `STREAM_API_KEY`/`STREAM_API_SECRET` (and the demo `*_STAGING` pair) must have the Video product enabled (owner confirmed enabled). The Android audio room needs native WebRTC code, so it only runs in an EAS dev/production build — not in Expo Go; the Stream Video and `@config-plugins/react-native-webrtc` Expo config plugins (wired in `ctf/packages/mobile/app.config.ts`) write the microphone permission and build settings at prebuild time. Speaker-vs-listener moderation (request-to-speak grant flow) is not yet built on either platform — every joiner may speak.
4. Multi-room platform is unbuilt. The MVP runs one hardcoded shared room; `Chyme.tsx`'s multiple-room directory, room creation, upcoming/scheduled rooms, search, reactions, and speaker/audience promotion (raise-hand-to-speak) are the design target but are not implemented — there are no create-room, list-rooms, scheduling, search, reaction, or promotion routes. The plugin registry reflects this as `implemented_shell`.
5. Account/data deletion has no in-app entry point after the Chyme buttons were removed (2026-06-01). The `DELETE /api/account/chyme-profile` and `DELETE /api/account/full-account` endpoints still work; a designed account-settings surface to call them is queued with the design agent.
6. `POST /api/chyme/join` is the one remaining chyme mutation not yet calling `ensureMutationCsrf` (it mints Stream credentials and upserts presence; it was outside the named scope of the CSRF passes). The web client already sends the header for it via `requestJson`; protecting it server-side would also need `x-ctf-csrf: '1'` added to the mobile `postChymeJoin` call. Low-risk follow-up.

## Change Log

- 2026-06-25: **Added CSRF guards to the remaining chyme mutation routes** (`hand` / `messages` POST / `leave` / `heartbeat`) — owner-approved follow-up to the service-credits fix. Each now calls `ensureMutationCsrf` after the access gate (`leave` and `heartbeat` gained a `request` parameter). Because these routes have **live clients** (unlike the service-credits route), their callers were updated to send `x-ctf-csrf: '1'`: the web `requestJson` helper (`components/chyme/chyme-shared.ts`) now attaches it on every non-GET request (covers messages + leave), the two raw `fetch` calls in `chyme-audio-room.tsx` (heartbeat, hand) add it inline, and the mobile `postChymeMessage` (`ChymeApi.ts`) adds it. Verified: `@ctf/web` + `@ctf/mobile` typecheck clean and web eslint clean. `POST /api/chyme/join` remains the one chyme mutation without the guard (tracked in Gaps item 6).
- 2026-06-25: **Added the missing CSRF guard to `POST /api/chyme/service-credits`** (security hardening — owner-approved). The money-moving send route was gated by `requireChymeAccess` only; it now also calls `ensureMutationCsrf` (requires `x-ctf-csrf: '1'` + same-origin host), matching every sibling plugin's service-credits route (lighthouse / foundation / skills-hunt / socketrelay). Added a chyme `ensureMutationCsrf` helper to `app/api/chyme/_lib.ts` (mirroring the socketrelay/foundation implementation, using the shared `checkMutationOrigin`) and a `csrfDenied: 'CHYME_CSRF_DENIED'` code to `CHYME_ERROR_CODE`. No client currently calls this route (it is an unwired backend endpoint — `sendServiceCredits` has no caller outside the handler), so nothing breaks; whenever a UI is wired up it sends the same `x-ctf-csrf: '1'` header as all other mutations. Resolves the Gaps item recorded earlier today; the remaining non-money chyme mutations are tracked as the new Gaps item 6. Web typecheck clean (`pnpm --dir ctf --filter @ctf/web run typecheck`).
- 2026-06-25: **Documented the service-credits route** (inventory-debt burn-down — documentation catch-up, no code change). Added `POST /api/chyme/service-credits` (send credits caller→`toUserId` via `sendServiceCredits` / the shared transfer primitive; gated by `requireChymeAccess`) to the route map. While verifying the handler, recorded a real finding in Gaps (item 6): this money-moving route has no `ensureMutationCsrf` check, unlike its sibling plugin service-credits routes — a CSRF guard for parity is a follow-up code change. Removed the route from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-20: Made the raise/lower hand **persistent**. Previously a raised hand rode on Stream's transient reaction (`participant.reaction`), which the SDK auto-clears after a few seconds, so other members never saw it stay up. The state is now stored server-side: new `hand_raised BOOLEAN NOT NULL DEFAULT FALSE` column on `chyme_room_members` (guarded `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for legacy DBs), new `setRoomMemberHandRaised(identity, raised)` repository function (updates the caller's presence row and returns refreshed room state), and new `POST /api/chyme/hand` route (`{ raised: boolean }` → `{ ok, room }`, gated by `requireChymeAccess`, audit command `chyme.hand`). `ChymeParticipant` and `listRoomParticipants` carry `handRaised`. In the web stage, `chyme-room-view` derives a set of clerk user ids with a raised hand from `room.participants` and threads it through `ChymeAudioRoom` → `ChymeAudioRoomLive` → `ChymeSpeakerTile`; each non-self, non-guest tile shows the ✋ when its `chyme-<clerkUserId>` (prefix stripped) is in the set. The local member stays driven by their own instant local toggle (which now also POSTs to persist). `chyme-live-shell` adds a light room poll every 15s (only while the tab is visible, mirroring the heartbeat's visibility guard; updates only `room`, leaving chat/draft untouched) so other members' hands appear/disappear without a manual refresh. Leaving deletes the presence row (clearing the hand), and stale presence drops the member from `listRoomParticipants` via the freshness window — so a departed member never lingers with a hand up. Command and audit contracts updated. No Android change in this pass (web + mobile-responsive).
- 2026-06-19: Let signed-out visitors **listen** to the one default room when it is live, resolving the contradiction between the "free to listen" guest banner and the members-only reality. New public `GET /api/chyme/public/room` returns the default room's live status and, only when live, an ephemeral guest Stream identity (`createChymeGuestListenCredentials`); new `getPublicRoomLiveState()` reads the room with no identity (a guest is not a member). New `components/chyme/chyme-guest-listen.tsx` connects that guest to the same `default` call and plays its audio receive-only (camera + microphone disabled, no speak/raise-hand controls); `components/chyme/chyme-public-shell.tsx` fetches the endpoint and renders the listener when live. Speaking still requires sign-in. Listen-only is enforced client-side; server-side publish restriction would need Stream call-type roles (flagged in the quota note). Stream Quota Impact Note added (`docs/quota-impact/2026-06-19-chyme-guest-listen.md`) — guests accrue Stream Video participant-minutes while listening, only when a room is live. No schema change (the default room is the public one by its existing `chyme-main-room` key).
- 2026-06-13: Tuned the presence heartbeat to cut idle database cost. The audio room now pings `/api/chyme/heartbeat` every **35s** (was 20s) and **only while the browser tab is visible** (Page Visibility API); a backgrounded/forgotten tab stops pinging, so it stops writing `last_seen_at` and drops out of presence after the 45s window — and the database compute is no longer pinned awake by an open tab. Returning to the tab pings immediately so the member reappears without waiting. 35s stays comfortably inside `CHYME_PRESENCE_TTL_SECONDS` (45s). No schema, route, or contract change.
- 2026-06-13: Fixed room presence so a member can actually leave, is removed on disconnect, and is never shown twice. Presence now means "joined the call," not "viewing the page": `upsertMember` was removed from `getRoomState`, `listRoomMessages`, and `sendRoomMessage` (merely opening Chyme or chatting no longer lists you on stage). `listRoomParticipants` now only returns members seen within `CHYME_PRESENCE_TTL_SECONDS` (45s), so a disconnected member drops off automatically. New `POST /api/chyme/heartbeat` (refreshes `last_seen_at` every 20s while in the audio room) and `POST /api/chyme/leave` (deletes the member row on Leave, called from the live shell). `callActive`/"Live" is now derived from fresh presence (`participants.length > 0`) instead of a stored flag nothing turned off. The web audio room de-dupes stage tiles by `userId` (a lingering extra Stream session no longer renders the same user twice). New audit command `chyme.call.leave`. No schema change (`chyme_room_members.last_seen_at` already existed).
- 2026-06-08: Built the Android (React Native) live audio room for parity with the web room (issue #265). New `ctf/packages/mobile/src/features/chyme/ChymeAudioRoom.tsx` mirrors `components/chyme/chyme-audio-room.tsx` one-to-one using `@stream-io/video-react-native-sdk`: joins the `default` call type audio-only with `{ create: true }`, starts muted, real microphone mute/unmute (`microphone.toggle()`), live participant tiles driven by `useParticipants()` with speaking/mute state, raise-hand broadcast (Stream reaction), and a real leave on exit. `ChymeRoom.tsx` now stores the `POST /api/chyme/join` credentials and renders `ChymeAudioRoom` for the in-room state; the old static `chyme-active-room.tsx` stage was removed. The SAME Stream user token serves chat and audio, so no second token call and no token-route change were needed (the join route mints the token with `stream-chat`'s `createToken`, which is product-agnostic; the web room already reuses it for Video). Dependencies added to `ctf/packages/mobile/package.json`: `@stream-io/react-native-webrtc@137.1.3`, `@react-native-community/netinfo@11.5.2`, `react-native-svg@15.15.3`, `expo-build-properties@~55.0.13`, and dev `@config-plugins/react-native-webrtc@14.0.0`. `app.config.ts` wires the `@stream-io/video-react-native-sdk` and `@config-plugins/react-native-webrtc` Expo config plugins (microphone permission text, audio background mode, Android WebRTC permissions). NOT verifiable here: the live audio needs an EAS dev build on a device — typecheck, lint, EOF, parity, and lockfile-sync all pass, but the actual join/speak/hear path must be confirmed on a device.
- 2026-06-08: Added the signed-out visitor (public) web view. New `components/chyme/chyme-public-shell.tsx` renders the public experience pixel-faithful to `design/.../survivor-hub/ChymePublic.tsx` (desktop) and `MobileChymePublic.tsx` (phone width), with sign-in/join affordances pointing at the hosted sign-in URL. This is part of a shared framework: the plugin route (`app/apps/[pluginSlug]/page.tsx`) now detects the anonymous-visitor denial (`AUTH_UNAUTHORIZED`) and renders that plugin's public shell from a slug-to-shell registry (`components/plugins/public-visitor-registry.tsx`) instead of the access-denied wall; plugins with no bespoke public shell fall back to a generic public shell. The view carries no private or per-user data — there is no public room-listing endpoint, so the room list shows an honest empty state, not the mockup's placeholder rooms. The earlier note that "Chyme is auth-only, public state not applicable" is superseded for the signed-out browse view; speaking, hosting, reacting, and saving still require sign-in. Web + mobile-responsive complete; no Android change (the framework is web-only). TypeScript: zero errors. EOF: clean. Parity check: passed.
- 2026-06-02: Dropped the redundant `display_name` column from `chyme_room_members` and `chyme_messages`. That column only ever held the author's `@username`, which duplicated the raw `username` already stored on each row. The domain types, repository, API identity, web components, and Android feature now expose and render the raw `username`, formatting it as `@username` at display time (falling back to `user-<first 8 of user id>` when a username is null). A guarded, idempotent migration (`ctf/db/migrations/post/0002_chyme_drop_display_name.sql`) drops the leftover column from any database that still has it; `schema.sql` no longer defines it. The deletion contract was updated to list `username` instead of `display_name` as the personal-data field on both tables.
- 2026-06-01: Built the real live audio room and removed the stubbed video panel. `components/shared/stream-video-panel.tsx` was a placeholder that called `videoClient.call('default', id).join()` with no `{ create: true }` and rendered "[Stream video UI coming soon]", so every join showed "Failed to join video room." Replaced it with `components/chyme/chyme-audio-room.tsx`, a real Stream Video integration: joins the `default` call type audio-only with `{ create: true }`, starts muted, real mute/unmute (`microphone.toggle()`), live participant tiles driven by `useParticipants()` with speaking and mute state, audio playback via `ParticipantsAudio`, raise-hand as a broadcast Stream reaction, and a real leave. The pre-join `chyme-stage` now only previews room membership; the live stage and controls are Stream-driven. The fake local `muted`/`handRaised` state in `chyme-live-shell` was removed. The live room is loaded client-only (`next/dynamic`, `ssr: false`). Requires the Stream app to have the Video product enabled (see Gaps #3).
- 2026-06-01: Removed the "Delete Chyme Data" / "Delete Full Account" buttons from the Chyme room (web `chyme-sidebar` / `chyme-live-shell` and mobile `ChymeRoom.tsx`) because they cluttered every room view; the deletion API endpoints are retained for a future designed account-settings surface (design queued). Also corrected the record: the shipped Chyme is a single-room MVP, and the full-featured `Chyme.tsx` (multi-room, create/discover, upcoming/scheduled, search, reactions, speaker/audience promotion) is the accepted design target, not yet built. The earlier "implementation is complete across web and Android" (2026-05-17) referred to the single-room workflows and their pixel pass, not the mockup's full feature set.
- 2026-05-31: Android pixel pass. Rewrote `ChymeRoom.tsx` aligned to `MobileChyme.tsx` / `MobileChymeEmpty.tsx` / `MobileChymeLoading.tsx` mockups. Decomposed into modular sub-components (`chyme-loading`, `chyme-empty`, `chyme-room-list`, `chyme-active-room`, `chyme-chat-view`), each within rule-116 200-line / complexity-10 limits. Added canonical `api.ts` entry-point re-exporting from `ChymeApi.ts`. All UI state (loading, empty, room-list, in-room, chat) bound to real `/api/chyme/room`, `/api/chyme/messages`, `/api/chyme/join`, and account deletion endpoints. Public state omitted — Chyme is auth-only. TypeScript: zero errors. EOF: clean. Parity check: passed.
- 2026-05-29: Modularity refactor. Decomposed the oversized `ChymeLiveShell` (359 lines / complexity 40, a pre-existing rule-116 violation) into modular sub-components (`chyme-header`, `chyme-sidebar`, `chyme-room-view`, `chyme-stage`, `chyme-chat-panel`, `chyme-controls`, `chyme-shared`), each within the 200-line / complexity-10 limits. No behavior, API, or copy change.
- 2026-05-29: Design-sync reconcile to `c5d83c0`. Removed user-facing "GetStream" wording from `chyme-live-shell`: "Social Audio · GetStream Powered" → "Social Audio · End-to-End Encrypted", the chat "GetStream" badge → "Encrypted", and "Audio via GetStream" → "Audio — encrypted". Copy-only.
- 2026-05-29: Web UI circle-back. Aligned `chyme-live-shell` to the `Chyme.tsx` mockup by replacing emoji glyphs with the mockup's lucide-react icons (Radio, Mic/MicOff, Hand, Phone, MessageSquare, Hash, Send, Volume2, Users, Lock, RefreshCw); structure and palette already matched. API wiring unchanged.
- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language (Delivery Phasing section); confirmed implementation is complete across web and Android. Renamed section to "Gaps and Known Technical Debt" (Rule 120 format).
- 2026-04-05: Completed Android parity on the real Chyme API surface, queued ServiceCredits reclaim dependency on full-account delete, and aligned Chyme docs to `ctf/schema.sql` plus shared Stream wrappers.
- 2026-02-25: Created initial Chyme CTF rewrite inventory and documented governance/parity requirements.


## Build Checklist


### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - Chyme implementation and supporting artifacts stay under `ctf/`.
- [x] Confirm plugin ID and room key stability.
  - Acceptance criteria:
    - Plugin slug remains `chyme`.
    - Default room remains `chyme-main-room` unless an explicit migration plan is approved.
- [x] Confirm profile/deletion contract exists.
  - Acceptance criteria:
    - `ctf/docs/contracts/CHYME_PROFILE_AND_DELETION_CONTRACT.md` exists and maps expected behavior.

### Baseline Prerequisite Gate (Mandatory)

- [x] Confirm baseline sequence completion before Chyme build start.
  - Acceptance criteria:
    - Auth foundation completed.
    - Railway deployment baseline completed.
    - Vercel staging integration completed.
    - Expo baseline completed.

### �� Core Implementation and Contract Alignment

- [x] Implement Chyme room bootstrap route behavior.
  - Acceptance criteria:
    - `GET /api/chyme/room` creates/loads deterministic room and upserts participant profile/member for eligible users.
- [x] Implement Chyme chat list/send route behavior.
  - Acceptance criteria:
    - `GET /api/chyme/messages` returns bounded room history.
    - `POST /api/chyme/messages` trims input, rejects empty text, and persists valid messages.
- [x] Implement Stream join route behavior.
  - Acceptance criteria:
    - `POST /api/chyme/join` returns Stream credentials when server config is present.
    - Route returns `503` when Stream server config is unavailable.
- [x] Implement migration/data model coverage.
  - Acceptance criteria:
    - Core Chyme tables and indexes exist and match route assumptions.
- [x] Confirm command/access/audit contract alignment.
  - Acceptance criteria:
    - Chyme command contract follows Rule 201 template conventions.
    - Chyme access/deny policy contract follows Rule 202 template conventions.
    - Chyme audit contract follows Rule 203 template conventions.

### �� Deletion and Compliance

- [x] Implement service-scoped deletion flow.
  - Acceptance criteria:
    - `DELETE /api/account/chyme-profile` marks service profile deleted and records service deletion event.
- [x] Implement full-account request behavior.
  - Acceptance criteria:
    - `DELETE /api/account/full-account` records account-scope deletion request and enqueues downstream reclaim dependency.
- [x] Align full-account lifecycle statuses with global orchestrator model.
  - Acceptance criteria:
    - Status model (`requested`/`processing`/`completed`/`failed`) is represented consistently in account deletion workflow.

### �� Seed and Deterministic Dev Validation

- [x] Add deterministic Chyme seed script.
  - Acceptance criteria:
    - Seed script under `ctf/scripts/` creates predictable Chyme baseline test data for local/dev validation.
- [x] Capture dev validation evidence. [MANUAL VALIDATION CHECKLIST DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Seed data can be regenerated for local/dev manual validation.

### �� Web/Android Parity

- [x] Confirm web Chyme baseline is implemented.
  - Acceptance criteria:
    - Web UI and API support room, chat, join, and deletion actions.
- [x] Implement Android parity for Chyme plugin flows.
  - Acceptance criteria:
    - Android delivers equivalent room/chat/join/deletion behavior and policy outcomes using the protected Chyme API surface.
- [x] Close platform parity deferment with owner/date (if not delivered in same phase).
  - Acceptance criteria:
    - Parity no longer depends on a deferred follow-up owner/date.

### �� Release Gates and Lifecycle Maintenance

- [x] Keep Chyme inventory/checklist synchronized with accepted changes. [EVIDENCE CAPTURE DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Feature/behavior changes update both Chyme docs in the same PR.
- [x] Record release-gate compliance status.
  - Acceptance criteria:
    - Command/access/audit contracts, migration evidence, and policy/audit checks are linked before release cut.
- [x] Add Stream quota-impact and validation artifacts.
  - Acceptance criteria:
    - Chyme has a dedicated quota-impact note and updated validation instructions aligned to canonical schema flow.

### Change Log

- 2026-02-25: Created initial Chyme rewrite checklist with baseline sections and governance requirements.
- 2026-03-01: Replaced implemented-baseline validation checklist with fresh-start implementation checklist and baseline prerequisite gate.
- 2026-03-01: Completed Phase 0 web/API/migration/policy/audit scope and recorded Android parity deferment owner/date.
- 2026-03-02: Added Chyme closure handoff evidence and second-pass runtime de-scaffolding updates (join call state persistence).
- 2026-04-05: Closed Android deferment, wired ServiceCredits reclaim dependency queueing for full-account delete, and added release evidence for schema/quota/validation alignment.
