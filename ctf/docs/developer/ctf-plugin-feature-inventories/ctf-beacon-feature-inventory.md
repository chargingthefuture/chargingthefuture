# Beacon Plugin Feature Inventory (CTF v3)

> **Status: PLANNED — not yet built.** This document is the agreed plan and the single source of
> truth for the Beacon plugin. All owner decisions below are locked (2026-06-21). The build follows
> the Build Checklist at the bottom, in dependency order, after the in-flight Commons work merges.

## Scope and Boundary

- Plugin name (user-facing): **Beacon**
- Plugin slug / service key: `beacon`
- Owned surfaces: `/apps/beacon` (member/public viewer), `/admin/beacon` (admin broadcaster + controls),
  `/api/beacon/*` routes, `beacon_*` tables.
- Not owned: identity (Clerk), the Commons/feed it posts into (feed plugin), Chyme (untouched —
  Beacon is a separate plugin, Chyme stays exactly as it is).

## Intent and Outcome

Beacon lets an admin go live ad hoc — a one-way video broadcast from a phone or desktop — so the
community can watch and take part in real time. Its flagship use is the **State of the TI Skills
Economy** address (a "state of the union"-style update the owner gives whenever there is something to
say, not on a fixed cadence).

It exists because the previous approach (Twitch) had friction the community could not get past: Twitch
required a phone number to sign up, and some people could not create an account at all, so they could
not join or comment. Beacon removes that wall — anyone can watch with just a link, and members (who
already have accounts) sign in to chat and react.

The broadcast is **one-way**: only the admin publishes video/audio; everyone else watches. When the
admin goes live, Beacon auto-posts a "live now" notice to the Commons so members discover it in the
feed; when the event ends, Beacon auto-posts the recording to the Commons as a replay.

## Owner-Locked Decisions (2026-06-21)

1. **Name = Beacon; slug = `beacon`.** Flagship event = the "State of the TI Skills Economy" address.
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

## Architecture

- **Video = Stream Video, `livestream` call type.** The admin joins as the **host** role (publishes
  camera/mic; "backstage" until they press Go Live, then `goLive()`). The call type's role permissions
  forbid publishing for anyone who is not the host, enforced by server-minted tokens.
  - **Public viewers watch via the HLS playback URL** that Stream produces for a livestream call. HLS
    playback needs no Stream user token, which is exactly what makes anonymous public watching work
    and scales to many viewers.
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

## Target User Features (viewer surface, `/apps/beacon`)

1. **Watch publicly.** Anyone with the link watches the live broadcast (HLS), no sign-in.
2. **Idle state.** When nothing is live, a calm "No live event right now" screen (with the last
   replay, if any).
3. **Live chat (members).** Signed-in members post chat messages during the event; anonymous viewers
   see a "sign in to chat" prompt.
4. **Live reactions (members).** Signed-in members send reactions during the event.
5. **Replay.** After the event, the recording is watchable (and is also posted to the Commons).
6. **"Live and public" indicator.** A clear marker that the broadcast is public so participants know
   their comments are visible.

## Target Admin Features (admin surface, `/admin/beacon`)

1. **Create an event** (title + description).
2. **Go Live** — broadcast camera/mic from phone or desktop (host role), which flips the event to
   `live` and auto-posts the "live now" notice to the Commons.
3. **Read the live chat and respond** in real time.
4. **Moderate** — mute a member, ban a member from the event chat, enable slow-mode.
5. **End the event** — stops the broadcast and billing; on recording-ready, auto-posts the replay to
   the Commons.
6. **See event history** (past events + their recordings).

## API Surface and Route Map

### Member / public routes
- `GET /api/beacon/current` — the currently-live event (or null) + the public HLS playback URL.
- `POST /api/beacon/[id]/chat-token` — mint a Stream Chat token for the live event chat. **Requires a
  signed-in member** (this is the sign-in-to-chat gate). Anonymous callers get 401.

### Admin routes (admin-gated)
- `POST /api/beacon` — create an event (draft).
- `POST /api/beacon/[id]/go-live` — host token + `goLive()`; flips status to `live`; auto-posts to
  Commons.
- `POST /api/beacon/[id]/end` — end the call; flips status to `ended`.
- `GET /api/beacon/admin` — list events.
- `POST /api/beacon/[id]/moderate` — mute / ban / slow-mode actions on the event chat.

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
7. Survivor-safety: the admin is the only person on camera; members are never required to appear; chat
   is text only.

## Web and Android Delivery Status

- Web (desktop + mobile-responsive): **planned, not started.**
- Android (React Native): **deferred** — viewer parity tracked by a parity ticket opened with the
  build PR.

## Seed Coverage Status

Planned: a seed for one past `ended` event with a recording URL, so the viewer idle state and the
admin history list render with real data in demos.

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
4. **Server lib** (`lib/beacon/*`) — Stream Video livestream credential minting (host vs viewer
   roles + the public HLS URL), call lifecycle (create → goLive → end), Stream Chat token minting for
   members, recording handling, Commons auto-post helpers. *(depends on 2; blocks 5, 7, 8)*
5. **API routes** — member/public (`current`, `chat-token`), admin (`create`, `go-live`, `end`,
   `admin` list, `moderate`), and the `stream-webhook`. *(depends on 4)*
6. **Commons auto-post** — "live now" on go-live and "replay" on recording-ready, idempotent.
   *(depends on 5)*
7. **Admin UI** (`/admin/beacon`) — create, Go Live broadcaster (phone/desktop), live chat + moderation,
   end, history/recordings. *(depends on 4, 5)*
8. **Viewer UI** (`/apps/beacon`) — public HLS player, idle state, member live chat/reactions, "live and
   public" indicator, replay. *(depends on 4, 5)*
9. **Seed** — one past `ended` event with a recording.
10. **Quota-impact note** under `ctf/docs/quota-impact/`.
11. **Trust-signal record** — mark not-applicable with the reason (this file already does).
12. **Android viewer parity** — deferred via a parity ticket on the build PR.

## Change Log

- 2026-06-21: Plan created. All owner decisions locked (name Beacon; public watch, sign-in to
  chat/react; ephemeral chat; one-way `livestream` broadcast; recording auto-posts to Commons; admin
  moderation + "live and public" indicator; Chyme untouched). Flagship event = the State of the TI
  Skills Economy address. Not yet built.
