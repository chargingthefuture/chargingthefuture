# Beacon Plugin Feature Inventory (CTF v3)

> Status: web built (admin broadcaster + public viewer); Android viewer parity deferred. This
> document is the single source of truth for the Beacon plugin. All owner decisions below are locked
> (2026-06-21).

## Scope and Boundary

- Plugin name (user-facing): **Beacon**
- Plugin slug / service key: `beacon`
- Owned surfaces: `/apps/beacon` (member/public viewer), `/admin/beacon` (admin broadcaster + controls),
  `/api/beacon/*` routes, `beacon_*` tables.
- Not owned: identity (Clerk), the Commons/feed it posts into (feed plugin), Chyme (untouched —
  Beacon is a separate plugin, Chyme stays exactly as it is).

## Intent and Outcome

Beacon lets an admin go live ad hoc — a one-way broadcast — so the community can watch and take part
in real time. The broadcast is primarily a **live demo of the app**: the admin streams their **phone
screen** (or a desktop screen/window) to show features live, not just a face cam. Its flagship use is
the **State of the Skills Economy** address (a "state of the union"-style update the owner gives
whenever there is something to say, not on a fixed cadence).

It exists because the previous approach (Twitch) had friction the community could not get past: Twitch
required a phone number to sign up, and some people could not create an account at all, so they could
not join or comment. Beacon removes that wall — anyone can watch with just a link, and members (who
already have accounts) sign in to chat and react.

The broadcast is **one-way**: only the admin publishes video/audio; everyone else watches. When the
admin goes live, Beacon auto-posts a "live now" notice to the Commons so members discover it in the
feed; when the event ends, Beacon auto-posts the recording to the Commons as a replay.

## Owner-Locked Decisions (2026-06-21)

1. **Name = Beacon; slug = `beacon`.** Flagship event = the "State of the Skills Economy" address.
2. **Watching is public; chatting/reacting requires sign-in.** Anyone with the link watches without an
   account (max reach, no phone-number wall). To post a chat message or a reaction you must be a
   signed-in member, so every comment is tied to a real account the admin can moderate. This is a
   deliberate survivor-safety choice: no anonymous chat.
3. **Live chat is ephemeral (Stream only).** The live chat is not persisted in our database. The video
   recording is saved and posted to the Commons.
4. **One-way broadcast.** Only the admin publishes. Viewers can never publish video/audio.
5. **Ad hoc, not scheduled.** No cadence; the admin spins up an event whenever.
6. **Chyme is untouched.** Beacon is a separate plugin; it does not change Chyme's audio rooms.
7. **Admin moderation + a clear "live and public" indicator are in scope from v1** (mute, ban,
   slow-mode; an unmistakable on-screen marker that the broadcast is public).
8. **Broadcast input = RTMP ingest (for the phone) + in-browser desktop screen-share.** The broadcast
   is a live demo (screen content), and a phone's **web browser cannot capture the phone's screen**, so
   the admin streams the phone screen by pushing it through a third-party mobile broadcaster app (e.g.
   Larix Broadcaster) to a private RTMP URL + stream key that Beacon mints per event. For demos from a
   computer, the Beacon admin page captures a desktop screen/window directly (browser screen-share) and
   publishes via the Stream web SDK. Both feed the same livestream call. Native in-app phone screen
   capture is explicitly out of scope for v1.

## Architecture

- **Video = Stream Video, `livestream` call type.** The admin is the only publisher, via two input
  paths into the same call:
  - **Phone demo → RTMP ingest.** Beacon requests Stream's per-call RTMP ingest URL + stream key and
    shows them to the admin; the admin pushes the phone screen from a mobile broadcaster app. Stream
    distributes it to viewers.
  - **Desktop demo → in-browser screen-share.** From `/admin/beacon`, the admin captures a desktop
    screen/window (browser `getDisplayMedia`) and publishes through the Stream web SDK as the host.

  The call uses "backstage" until the admin presses Go Live (`goLive()`). The call type's role
  permissions forbid publishing for anyone who is not the host, enforced by server-minted tokens.
  - **Public viewers watch via the HLS playback URL** that Stream produces for a livestream call. HLS
    playback needs no Stream user token, which is exactly what makes anonymous public watching work
    and scales to many viewers. The viewer plays HLS natively on Safari/iOS and uses the `hls.js`
    library on every other browser (loaded only in the browser, only when a live URL is present, and
    torn down on unmount / URL change).
  - Signed-in members who want the lower-latency WebRTC view can still join as a viewer-role token, but
    the default public path is HLS.
- **Chat/reactions = Stream Chat, `livestream` channel**, channel id derived from the event id. Only
  signed-in members get a Stream Chat token (so only members can post); the admin is the channel
  moderator (mute/ban/slow-mode). Reuses the rich `StreamChatPanel` shipped in the Stream initiative.
  Anonymous public viewers see the chat read-only (or a "sign in to chat" prompt) but cannot post.
- **Recording = Stream Video recording.** Recording is enabled on the call; when it is ready Stream
  delivers the URL via webhook. Beacon stores the URL and posts the replay to the Commons.
- **Commons integration** reuses the existing feed/announcement path: a "🔴 Live now" entry on go-live
  (linking to `/apps/beacon`) and a "▶️ Watch the replay" entry when the recording is ready.

## User Features (viewer surface, `/apps/beacon`)

1. **Watch publicly.** Anyone with the link watches the live broadcast (HLS), no sign-in.
2. **Idle state.** When nothing is live, a calm "No live event right now" screen (with the last
   replay, if any).
3. **Live chat (members).** Signed-in members post chat messages during the event; anonymous viewers
   see a "sign in to chat" prompt.
4. **Live reactions (members).** Signed-in members send reactions during the event.
5. **Replay.** After the event, the recording is watchable (and is also posted to the Commons).
6. **"Live and public" indicator.** A clear marker that the broadcast is public so participants know
   their comments are visible.

## Admin Features (admin surface, `/admin/beacon`)

1. **Create an event** (title + description).
2. **Go Live** — for a phone demo, Beacon shows the per-event RTMP URL + stream key to paste into a
   mobile broadcaster app; for a desktop demo, a "Share screen" button captures a screen/window in the
   browser. Either way Go Live flips the event to `live` and auto-posts the "live now" notice to the
   Commons. The host is the only publisher.
3. **Read the live chat and respond** in real time.
4. **Moderate** — mute a member, ban a member from the event chat, enable slow-mode.
5. **End the event** — stops the broadcast and billing; on recording-ready, auto-posts the replay to
   the Commons.
6. **See event history** (past events + their recordings).
7. **Delete a draft** — a draft that was mistyped or abandoned can be removed from the Event history
   list. Two clicks: `Delete` arms the row, `Confirm delete` does it. **Drafts only** — a live or
   ended event has no delete control, and the route refuses one with a 409, because an ended event is
   public broadcast history with a recording attached. A draft was never broadcast, has no recording,
   and never appeared in the member view, so removing one takes away nothing a member saw.

## API Surface and Route Map

### Member / public routes
- `GET /api/beacon/current` — the currently-live event (or null) + the public HLS playback URL.
- `POST /api/beacon/[id]/chat-token` — mint a Stream Chat token for the live event chat. **Requires a
  signed-in member** (this is the sign-in-to-chat gate). Anonymous callers get 401.

### Admin routes (admin-gated)
- `POST /api/beacon` — create an event (draft).
- `GET /api/beacon/[id]/ingest` — return the per-event RTMP ingest URL + stream key (for the phone
  broadcaster app) and a host token (for desktop in-browser screen-share). Admin-only.
- `POST /api/beacon/[id]/go-live` — flip the call out of backstage (`goLive` with an empty body, no
  HLS/recording yet); flips status to `live`; auto-posts to Commons. The host stage mounts after this
  succeeds, so there is no publisher yet — HLS/recording start later via `start-broadcast`.
- `POST /api/beacon/[id]/start-broadcast` — start the public HLS broadcast + recording once a host is
  publishing media to the call (called by the in-browser screen-share when sharing begins). Admin-only,
  idempotent.
- `POST /api/beacon/[id]/end` — end the call; flips status to `ended`.
- `GET /api/beacon/admin` — list events.
- `POST /api/beacon/[id]/moderate` — mute / ban / slow-mode actions on the event chat.
- `DELETE /api/beacon/[id]` — delete a **draft** event. Refuses a `live` or `ended` event with a 409
  (`beacon_conflict`); the draft-only rule is enforced in the route and again in the SQL predicate of
  `deleteDraftBeaconEvent`. Both the deletion and a refused attempt are written to the audit trail.

### Webhook
- `POST /api/beacon/stream-webhook` — Stream recording-ready (and call lifecycle) events; verifies the
  Stream signature, stores `recording_url`, posts the replay to the Commons.

## Data Model and Storage Contracts

### Tables owned by this plugin
1. `beacon_events` — id, title, description, status (`draft`/`live`/`ended`), host_user_id,
   stream_call_type (`livestream`), stream_call_id, started_at, ended_at, recording_url,
   recording_ready_at, commons_live_post_id, commons_recording_post_id, created_at, updated_at.
2. `beacon_events_admin_audit_trail` — actor_id, command, policy_status, reason, target_type,
   target_id, metadata, created_at.

Live chat and reactions are **not** stored (ephemeral, in Stream). Use the
`CREATE TABLE IF NOT EXISTS` + `ALTER … ADD COLUMN IF NOT EXISTS` pattern, and give every column a
default on the ALTER (the `id` default lesson from the announcements fix). Regenerate
`schema.demo.sql`.

## Security, Privacy, and Compliance Controls

1. Deny-by-default authorization: every admin command is admin-gated; the chat-token route requires a
   signed-in member; only the public viewer read and the HLS URL are open.
2. **No anonymous chat** — posting requires a member account, so every comment is attributable and
   moderatable (mute/ban/slow-mode).
3. **Clear "live and public" indicator** so participants know the broadcast and chat are public.
4. **One-way publishing enforced server-side** — viewer tokens lack publish capability; only the host
   token can publish.
5. **Recording consent/expectation** — because the broadcast is public and recorded, the admin UI
   states recording is on; the replay is posted publicly to the Commons.
6. Webhook signature verification on the Stream webhook; idempotent recording-post (never double-post
   the replay).
7. **Broadcast history cannot be deleted from the app.** The only delete path is `DELETE
   /api/beacon/[id]`, and it is restricted to `status = 'draft'` in two independent places (the route
   check and the SQL predicate). A `live` or `ended` event — the rows the deletion contract retains —
   has no delete control in the UI and is refused by the route.
8. Survivor-safety: the admin is the only person on camera; members are never required to appear; chat
   is text only.

## Web and Android Delivery Status

- Web (desktop + mobile-responsive): built. Admin broadcaster at `/admin/beacon` (create, go-live
  with RTMP url/key plus desktop screen-share, live chat + moderation, end, history). Public viewer
  at `/apps/beacon` (HLS player, "live and public" indicator, member live chat, idle/replay state).
  Both are mobile-responsive.
- Android (React Native): **surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now
  web-only, served by the installable web app (PWA). Historical detail: a viewer was previously built
  (issue #712). `src/features/beacon/` — `BeaconApi.ts` (the
  public `GET /api/beacon/current` and the member `POST /api/beacon/[id]/chat-token`) and a `Beacon.tsx`
  viewer screen registered in the mobile navigator (`App.tsx`). Same three states as web: live (HLS
  player via `expo-video` + the "live and public" indicator + member live chat through the reused
  `StreamChatView`; anonymous viewers see a sign-in-to-chat prompt and still watch), replay (plays the
  recording URL when one is present), idle ("no live event right now"). Admin broadcasting is not on
  mobile — the admin pushes the phone screen through a third-party RTMP app per the plan. The HLS player
  is a native module (`expo-video`); it runs only in an EAS dev/production build, not Expo Go.

## Seed Coverage Status

`ctf/scripts/seedBeaconPhase0.mjs` inserts one past `ended` event ("State of the Skills Economy")
with a recording URL and a deterministic UUID, plus one matching admin audit row. This makes the
viewer idle/replay state and the admin history list render with real data in demos. Re-runnable
(`ON CONFLICT (id) DO NOTHING`). No per-member rows are seeded (Beacon stores none).

## Trust Signal

**Not applicable for v1** (per rule 132): Beacon participation is watching and ephemeral live chat —
no durable per-member rows are completed/accepted/claimed/published, so there is no categorical Trust
signal to add. Revisit if a future version persists member participation.

## Stream Quota / Cost

Livestream **video minutes** are the app's most cost-sensitive Stream usage — cost scales with
viewers × duration, plus recording storage (Maker-tier rules, `110-stream-maker-tier-rules.mdc`). Ad
hoc, infrequent events keep this low. A dedicated quota-impact note under `ctf/docs/quota-impact/` is
**required** before the build merges, and the "End event" path must reliably stop the call so billing
stops. HLS is used for public viewers so scale does not multiply WebRTC cost.

## Gaps and Known Technical Debt (to decide during build)

- Exact Stream `livestream` role/permission config for host vs viewer (call type setup in the Stream
  dashboard) — document the dashboard settings alongside the build.
- Whether anonymous viewers see the live chat read-only or just a "sign in to chat" panel (lean
  read-only so the room feels alive).
- Replay hosting: link to Stream's recording URL vs. re-hosting; start with the Stream URL.

## Build Checklist (flat, ordered; dependency-named — no phases)

1. **Registry + scope** — add the `beacon` entry to `lib/plugins/repository.ts` (member-visible
   viewer; admin-gated controls). *(blocks the UI routes)*
2. **Schema** — `beacon_events` (+ audit) with the CREATE/ALTER pattern (defaults on every ALTER);
   regenerate `schema.demo.sql`; confirm the drift gate. *(blocks the server lib)*
3. **Contracts** — `BEACON_PLUGIN_COMMAND_CONTRACTS.yaml`, `BEACON_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`,
   `BEACON_PLUGIN_AUDIT_CONTRACTS.yaml`, `BEACON_PROFILE_AND_DELETION_CONTRACT.md`.
4. **Server lib** (`lib/beacon/*`) — Stream Video livestream credential minting (host token + the
   public HLS URL), the per-event **RTMP ingest URL + stream key**, call lifecycle (create → goLive →
   end), Stream Chat token minting for members, recording handling, Commons auto-post helpers.
   *(depends on 2; blocks 5, 7, 8)*
5. **API routes** — member/public (`current`, `chat-token`), admin (`create`, `ingest`, `go-live`,
   `end`, `admin` list, `moderate`), and the `stream-webhook`. *(depends on 4)*
6. **Commons auto-post** — "live now" on go-live and "replay" on recording-ready, idempotent.
   *(depends on 5)*
7. **Admin UI** (`/admin/beacon`) — create; Go Live with both input paths (show the RTMP URL/key for a
   phone broadcaster app, and a "Share screen" button for desktop in-browser screen-share); live chat +
   moderation; end; history/recordings. *(depends on 4, 5)*
8. **Viewer UI** (`/apps/beacon`) — public HLS player, idle state, member live chat/reactions, "live and
   public" indicator, replay. *(depends on 4, 5)*
9. **Seed** — one past `ended` event with a recording.
10. **Quota-impact note** under `ctf/docs/quota-impact/`.
11. **Trust-signal record** — mark not-applicable with the reason (this file already does).
12. **Android viewer parity** — deferred via a parity ticket on the build PR.

## Change Log

- 2026-08-08: **"Go live" failed every time because the recording settings were incomplete (owner
  report).** Opening the broadcast call was rejected by Stream with a 400 and the message
  `GetOrCreateCall failed with error: "recording quality is required when audio_only is false and
  recording is enabled"`, so the admin screen showed "Broadcast input unavailable" and no broadcast
  could start at all. Beacon asked Stream to create the call with `recording: { mode: 'available' }`
  and nothing else; Stream treats a video recording with no stated picture size as invalid and
  refuses the whole request, which meant the call was never created and neither the phone (RTMP) nor
  the in-browser screen-share input path had anything to publish into. The create request in
  `lib/beacon/stream.ts` now states both values Stream validates together: `audio_only: false` and
  `quality: '720p'`. 720p landscape matches what Beacon actually broadcasts — a shared screen or
  window from the browser, or a phone pushing RTMP — so the saved replay records the broadcast
  without being stretched. Recording behaviour is otherwise unchanged: recording is still
  `available` (started later by `start-broadcast` once someone is publishing), the recording-ready
  webhook and the Commons replay post are untouched. No schema, route, or contract change.
  Quota-impact note: `ctf/docs/quota-impact/2026-08-08-beacon-recording-quality.md`.
- 2026-07-27: **Admins can delete a draft event (owner report).** A mistyped or abandoned draft was
  permanent from the app's side — there was no delete control, no `DELETE` route, and no repository
  function — so the only way to remove one was a hand-written `DELETE` straight against the
  production database. Added `DELETE /api/beacon/[id]` (admin-gated, CSRF-checked, audited) plus
  `deleteDraftBeaconEvent()` in `lib/beacon/repository.ts`, and a two-click `Delete` → `Confirm
  delete` control on each draft row in the admin Event history.
  **Drafts only, guarded three times:** the button renders only for `status === 'draft'`; the route
  refuses anything else with a 409 and records the refusal in the audit trail; and the SQL itself
  carries `AND status = 'draft'`, so no future caller can delete broadcast history even by mistake.
  A draft has never been broadcast — no viewer saw it, it has no recording, and it is absent from the
  member view — so deleting one removes nothing a member ever saw, which is why this is not treated
  as destroying history. Contracts updated: new `event.delete` command, access policy
  (`draftStatusOnly`, deny condition `event_not_draft`), and audit event. No schema change.
- 2026-07-26: **Brand name: the flagship broadcast is the "State of the Skills Economy" address.** The
  product was renamed from "TI Skills Economy (TSE)" to **Skills Economy** in commit `bb0aa50`, but the
  old name survived in Beacon's seed data and docs. Renamed in `ctf/scripts/seedBeaconPhase0.mjs` (the
  seeded past event's title), the `schema.sql` / `schema.demo.sql` Beacon comment, this inventory, the
  Beacon test script, and the Beacon quota-impact note. Copy only — no schema, route, or contract
  change. Note for the owner: the seed inserts with `ON CONFLICT DO NOTHING`, so a production row
  already carrying the old title keeps it until renamed by hand; fresh and demo databases get the new
  title.
- 2026-07-20: **Account deletion now clears the member's Beacon Stream chat copy, and Beacon joined the deletion registry (privacy).** Two gaps: (1) Beacon had **no entry** in the account-deletion registry at all, so the orchestrator did not know about it; (2) a member's per-event live chat is sent into Stream Chat under `beacon-<userId>` and **persists** there (Stream retains chat with no expiry — it is not "ephemeral" as the older deletion contract assumed), yet nothing removed it on account deletion. Added a Beacon `deletion-registry` entry (`beacon_events` and `beacon_events_admin_audit_trail` are **retained** — public broadcast history and the admin audit trail, per the Beacon deletion contract — so Beacon deletes no Postgres rows, matching "no per-member rows"), and registered `deleteBeaconStreamData(userId)` (in `lib/beacon/stream.ts` — hard-deletes the Stream user `beacon-<userId>` with `mark_messages_deleted`; never throws) into the shared external-cleanup hook (`lib/account/external-cleanup-registry.ts`). The orchestrator runs it after the DB transaction commits on every whole-account deletion path (full-account route, internal delete, Clerk webhook), best-effort. Also corrected the deletion contract's "chat is ephemeral in Stream" claim. No schema change.
- 2026-07-19: **Copy: broadcasts are "from Farah", not "from the team" (owner report).** The
  platform has a single operator, so "the team" was inaccurate. Updated everywhere the phrase
  shipped: the plugin-registry summary (schema seed + in-code fallback), the web viewer intro and
  idle line, and the Android intro and idle line. Copy only; no schema-structure, route, or
  contract change (the seed row's summary text is upserted on the next database update run).

- 2026-07-18: **Beacon added to the app launcher (owner report: no way to reach the member page).**
  The `ctf_plugin_registry` seed in `ctf/schema.sql` had no `beacon` row, so the launcher — which
  reads the database registry, not the in-code fallback — never showed the tile and members could
  not reach `/apps/beacon` to see the idle/replay screen. Seed row added (nav rank 230, visible),
  matching the in-code fallback entry. No route, contract, or behavior change.

- 2026-07-17: **Admin↔member navigation (app-wide sweep).** The admin surface header gained the
  shared "Member view" pill (`PluginUserShellButton`) linking to `/apps/beacon`. The member shell
  header now shows the shared Admin shortcut (`PluginAdminButton`, admins only). UI-only; no
  schema, route, or contract change.
- 2026-07-14: Evaluated for the app-wide refresh-controls rollout and deliberately skipped — no
  manual refresh control added on either platform. Beacon is a watch-first live surface with no
  member-facing data list or stats view, and both viewers (web `beacon-viewer.tsx` and Android
  `Beacon.tsx`) already poll `GET /api/beacon/current` every 15 seconds, so live/idle/replay state
  re-pulls itself; a manual refresh would add nothing. No code change.
- 2026-06-21: Plan created. All owner decisions locked (name Beacon; public watch, sign-in to
  chat/react; ephemeral chat; one-way `livestream` broadcast; recording auto-posts to Commons; admin
  moderation + "live and public" indicator; Chyme untouched). Flagship event = the State of the TI
  Skills Economy address. Not yet built.
- 2026-06-21: Clarified the broadcast is a live demo (screen content), not a face cam, and locked
  the broadcast input: RTMP ingest for the phone (a phone web browser cannot capture its own
  screen, so the admin pushes the phone screen from a mobile broadcaster app to a per-event RTMP URL +
  key) plus in-browser desktop screen-share. Added the `GET /api/beacon/[id]/ingest` route and
  updated the architecture, admin features, and build checklist. Native in-app phone screen capture is
  out of scope for v1.
- 2026-06-21: Web build shipped on branch `feat/beacon-plugin`. Added the `beacon` registry entry; the
  `beacon_events` and `beacon_events_admin_audit_trail` tables (CREATE/ALTER pattern, regenerated
  `schema.demo.sql`); the four `BEACON_*` contracts; the server lib (`lib/beacon/` — Stream Video
  livestream lifecycle over the REST API, host token, public HLS URL, per-event RTMP ingest, member
  Stream Chat token, recording handling, webhook signature verify, Commons auto-post helpers); the API
  routes (`current`, `[id]/chat-token`, create, `[id]/ingest`, `[id]/go-live`, `[id]/end`, `admin`
  list, `[id]/moderate`, `stream-webhook`); idempotent Commons auto-post on go-live and
  recording-ready (post ids stored on the event row); the admin UI (`/admin/beacon`) and public viewer
  (`/apps/beacon`); the seed script; and the quota-impact note. A few Stream Video REST field/endpoint
  names were marked `TODO(beacon)` to confirm against the live docs before the first real broadcast;
  no URLs are fabricated when a field is absent. Android viewer parity deferred via a parity ticket.
- 2026-06-21: Resolved every `TODO(beacon)` and finished wiring the livestream end to end in code on
  branch `feat/beacon-stream-api-wiring`. Confirmed the Stream Video REST shapes against Stream's
  current docs and replaced each TODO with a one-line source comment: RTMP ingest at
  `call.ingress.rtmp.address` with the host user token used as the stream key (so
  `ensureBeaconCallAndIngest` now takes the host token rather than reading a non-existent
  `rtmp.stream_key` field, and the ingest route passes it through); HLS playback at
  `call.egress.hls.playlist_url`; the `go_live` (start_hls + start_recording) and `stop_live`
  endpoints; and the `call.recording_ready` webhook payload (`call_cid`, `call_recording.url`). Added
  `hls.js` as a web dependency and wired it into the public viewer: native HLS on Safari/iOS, `hls.js`
  on every other browser, loaded on demand in the browser and destroyed on unmount / URL change.
  Graceful degradation is unchanged — when Stream is unconfigured or a field is absent, every surface
  stays in its calm not-live/idle state and nothing throws. Still requires the owner: the Stream
  dashboard call-type/recording config and webhook registration, plus one live broadcast smoke test.
- 2026-06-23: Android viewer parity shipped on branch `feat/mobile-beacon-viewer` (issue #712). Added
  `ctf/packages/mobile/src/features/beacon/` — `BeaconApi.ts` (the public `GET /api/beacon/current` and
  the member-only `POST /api/beacon/[id]/chat-token`, both through `authedFetch`), `Beacon.tsx` (the
  viewer screen), `BeaconVideo.tsx` (the HLS surface), and `index.ts`. The screen polls
  `/api/beacon/current` every 15 seconds (matching web) and renders the same three states: live (HLS
  player + "live and public" indicator + member live chat / sign-in prompt), replay (plays the recording
  URL when present), idle. Member chat reuses the shared `StreamChatView`; a signed-in member requests a
  chat token (the server-side member gate), an anonymous viewer sees a sign-in-to-chat prompt and still
  watches over HLS. Registered Beacon in the mobile navigator (`App.tsx`) and flipped
  `requiresMobileSurface` to `true` in `config/plugin-parity-contracts.json`. Added a new native
  dependency, `expo-video` (the current Expo player; `expo-av` is not published for this Expo SDK), to
  play `.m3u8` HLS on iOS/Android. It is a native module: it does NOT run in Expo Go and needs an EAS
  rebuild — the owner must run `expo install expo-video` (or `pnpm install`) and an EAS dev/production
  build before the mobile viewer plays video. A matching quota-impact note is at
  `ctf/docs/quota-impact/2026-06-23-mobile-beacon-viewer.md`. Public/anonymous viewing is HLS only (no
  Stream chat connection); only a signed-in viewer of a live event opens a Stream Chat connection,
  bounded by concurrent live-event viewers, mirroring the web viewer.
- 2026-06-23: Split the mobile `Beacon.tsx` viewer into smaller per-state pieces so it stays under the
  modularity governance limits (the single render function had a cyclomatic complexity of 18, over the
  limit of 10). No behavior change: `Beacon.tsx` keeps the polling, chat-token lifecycle, and
  loading/live/idle selection; the markup moved into `BeaconLiveView.tsx` (live badge, video/starting
  frame, fineprint, and chat panel), `BeaconIdleView.tsx` (the no-live-event empty state plus the
  optional replay), and `BeaconChatGate.tsx` (the signed-in-vs-anonymous chat body). The HLS player,
  the live/replay/idle logic, and the member-only chat behavior are unchanged. Also recorded the
  missing `expo-video` entry in `pnpm-lock.yaml` (its `package.json` specifier was added with the
  viewer but the lockfile had not been updated), so a frozen-lockfile install resolves it.
- 2026-06-24: Fixed go-live so a broadcast can actually start (branch
  `fix/beacon-go-live-egress-timing`). The bug: `go-live` asked Stream to start HLS + recording at the
  moment the admin clicked "Go live", but the in-browser screen-share host mounts only after go-live
  succeeds, so there was no publisher yet and Stream rejected the request — every broadcast failed with a
  generic "Could not start the broadcast." Now `goLiveBeaconCall` only flips the call out of backstage
  (empty body, no HLS/recording), and a new `startBeaconBroadcastEgress` plus the new admin route
  `POST /api/beacon/[id]/start-broadcast` start HLS + recording once a host is actually publishing —
  triggered automatically the first time the in-browser screen-share goes live (a once-per-session
  guard, errors swallowed since egress is additive). Both admin error paths now surface the underlying
  Stream message instead of the generic text. Also: when the ingest fetch fails, the admin shell stops
  before calling go-live (it no longer overwrites the real error), and selecting an event (Open / Create
  draft) scrolls the Broadcast section into view so mobile users see the change. Added the
  `event.start-broadcast` command, access-policy, and audit contract entries. Note: HLS/recording are
  started once when a publisher is present (replacing the call that always failed), so net Stream usage
  is unchanged-to-positive with no new recurring calls.
- 2026-08-03: Made a failed "Go live" say why, and stopped two non-video steps from blocking a broadcast
  (branch `fix/beacon-go-live-failure-detail`; owner report from a phone: the banner read only
  "Broadcast input unavailable." with no way to tell what was wrong). Three changes, no route, schema,
  or contract change:
  1. `GET /api/beacon/[id]/ingest` no longer wraps every step in one catch that returns a single fixed
     sentence. Each step is attempted separately and names itself in the message the admin sees:
     loading the event ("Could not load the event: …", `beacon_persistence_unavailable`), preparing the
     host ("Broadcast input unavailable — preparing the host failed: …"), and opening the broadcast call
     ("Broadcast input unavailable — opening the broadcast call failed: …"). Stream-not-configured still
     answers "Live video is not configured." The echoed reason is capped at 300 characters. Each step
     also reports separately (`ingest_load_event`, `ingest_host_credentials`, `ingest_open_call`,
     `ingest_audit`), so error reporting shows which one failed.
  2. The ingest audit row is now written best-effort. It is bookkeeping; a failed audit write used to
     surface as a broadcast failure even though the RTMP details and host token were ready.
  3. Registering the host on Stream Chat (`upsertUser`) inside `createBeaconHostCredentials` is now
     best-effort, and releasing the Stream client is guarded. The host token is signed locally from the
     app secret and publishing video does not need the chat user to exist, so a Chat-side failure (quota,
     a chat-disabled app, a transient error) no longer stops a broadcast — it is reported
     (`host_chat_upsert`) and only the host's chat display name and moderator role are missed.
  Also, a failed Stream Video REST call now carries its HTTP status and endpoint alongside Stream's own
  message (`Stream Video POST /api/v2/video/call/… failed (403): …`) — the status is what distinguishes
  a misconfigured app from an unauthorized one from an over-quota one — and a non-JSON error body no
  longer replaces the status with a JSON parse error. The API key is never included (the path is logged
  without its query string). Quota-impact note:
  `ctf/docs/quota-impact/2026-08-03-beacon-go-live-failure-detail.md`.
