# Contributor Access — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the module works end to end. This script is
> generated from the module's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.

| | |
|---|---|
| **Module** | Contributor Access (`contributor-access`) |
| **Visibility** | Admin dashboard + two member surfaces: the gated `#contributors` channel inside the Commons (eligible members and admins only — invisible to everyone else) and the "Weavers of the Commons" badge on Directory profiles (no launcher tile) |
| **Roles to test** | admin · an eligible member · a non-eligible member |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android (React Native — member badge + gated channel surfaces) |
| **Seed first** | `pnpm --dir ctf seed:demo` (the engine reads upstream seeded tables) |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-contributor-access-feature-inventory.md` |
| **Generated** | 2026-07-18 (initial authoring) · updated 2026-07-18 (badge + gated channel slices; channel moderation, rate limit, delete) · updated 2026-07-19 (android parity ships: badge #1680 + gated channel #1681 — member cases gain an android column) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  module or on a pre-release sweep.
- The member surfaces are the gated channel and the Directory badge (CA-M1/CA-M2). The single
  most important property to confirm is the negative one: a non-eligible member finds **no
  trace** of the channel anywhere and no badge-absence state on any profile. Also confirm a
  non-admin cannot reach any of the admin surface.

---

## Core smoke (every session)

1. **Non-admin cannot reach it.** As a plain member, `/admin/contributor-access` redirects to
   `/apps`; there is no Contributor Access tile in the app launcher; the admin routes
   (`/api/contributor-access/admin/...`) deny with a stable reason and the deny is written to
   `contributor_access_audit_trail`. → web ☐ mobile ☐
2. **Config edits persist.** As an admin, change the score threshold and one per-event weight,
   save, reload the page: the saved values come back (they live in `contributor_access_config`,
   not browser state). → web ☐ mobile ☐
3. **Revoke requires a reason.** On an eligible member, the revoke action asks for a reason and a
   confirmation; an empty reason is refused with a visible message and no change lands. → web ☐ mobile ☐
4. **No score anywhere.** Nothing on the page, in any API response, or in any error shows a
   numeric score, points, rank, or per-event counts for a member — the standing is only
   eligible / revoked. This includes the eligible list payload
   (`GET /api/contributor-access/admin/eligible`: id, username, date, flags only) and the
   Directory badge read (`hasWeaversBadge` boolean only). → web ☐ mobile ☐
5. **Badge is positive-only.** On the Directory, a member without the badge shows nothing
   badge-related — no empty slot, no lock, no "not yet earned" state — and a community-generated
   (unclaimed) profile never carries the field. Same on the Android profile detail. → web ☐ mobile ☐
6. **Non-eligible member sees no gated channel.** As a signed-in member without the eligibility
   flag: the Commons channel list shows only `#general` (desktop rail; at phone widths no channel
   switch row appears at all), `GET /api/hub/channels` contains no `contributors` entry, and every
   `/api/contributor-access/channel/...` call answers a bare 404 — no locked teaser, no absence
   state, no different copy. On Android, the Commons shows no channel pill row at all — the screen
   is exactly the shipped single-channel Commons. → web ☐ mobile ☐

---

## Member walkthrough — the "Weavers of the Commons" badge

### CA-M1 · Badge appears only on claimed profiles of badge holders
**Role:** member · **Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** a claimed Directory profile whose member holds the badge
(`contributor_access_eligibility`: `eligible = TRUE`, `revoked_for_cause = FALSE`), a claimed
profile without it, an unclaimed (community-generated) profile, and — if available — a member who
was revoked for cause.
**Steps:**
1. Open the badge-holder's Directory profile.
2. Open the claimed profile without the badge, then the unclaimed profile.
3. If a revoked member exists, open their claimed profile.
**Expected:** The braid badge (rust circle, cream/gold three-strand braid ring) renders next to
the holder's name only. On everyone else — non-holder, unclaimed, revoked-for-cause — NOTHING
badge-related renders: no empty slot, no lock, no "not yet earned" state. The unclaimed profile's
API payload (`GET /api/directory/profiles/:id`) has no `hasWeaversBadge` field at all; a claimed
non-holder carries `hasWeaversBadge: false` in the payload but shows nothing in the UI. On
Android, the same rules hold on the Directory profile detail (the RN client reads the same list
payload).
**Result:** web ☐ mobile ☐ — notes:

### CA-M2 · Click-through dialog + "how it's earned" page
**Role:** member · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Click/tap the badge on a holder's profile.
2. Read every word of the dialog.
3. Follow the "How it's earned" link.
4. Sign out and open `/apps/directory/weavers-of-the-commons` directly.
**Expected:** The dialog is titled **"Weavers of the Commons"** with the body "This member is a
consistent, broad contributor to the community — real help, delivered over time. Anyone can earn
this." and a "How it's earned" link. Neither the dialog nor the page contains the words
"verified", "vetted", or "trusted". The page explains in plain language: earned by steadily
delivering real help to other members; permanent once earned; no application and no way to buy
it; no score shown anywhere; the same standing opens the members-only channel in the Commons when
it launches. It renders in the Directory shell style and works at phone width. Signed out, the
page redirects to `/apps/directory`.
**Android:** tapping the badge opens the same-titled dialog with the same body copy; instead of a
link, a condensed "How it's earned" paragraph renders inline in the dialog (earned by steadily
delivering real help; automatic; permanent; no application, no way to buy it, no score anywhere) —
steps 3–4 are web-only. The android copy must also never contain "verified", "vetted", or
"trusted".
**Result:** web ☐ mobile ☐ — notes:


---

## Admin walkthrough

### CA-A1 · Access gate — admin only
**Role:** admin (and a plain member to confirm denial) · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. As a plain member, open `/admin/contributor-access` and call `GET /api/contributor-access/admin/config`.
2. As an admin, open the same page.
**Expected:** The member is redirected to `/apps` and the route denies `missing_required_role`
(the `operations` role is NOT admitted — this module is admin-only). The admin sees the shell with
its three sections. Allow and deny both write `contributor_access_audit_trail` rows.
**Result:** web ☐ mobile ☐ — notes:

### CA-A2 · Eligible members list, revoke, reinstate
**Role:** admin · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Read the eligible list (empty state first if nobody qualifies yet — it explains the weekly
   recompute admits members as they qualify).
2. After a recompute has admitted someone, revoke them: supply a reason, confirm.
3. Reinstate the same member.
**Expected:** Revoke flips the row to "Revoked for cause" with the reason shown; the member's
`eligible` flag turns off but `first_earned_at` is untouched. Reinstate restores `eligible` and
clears the revocation fields. Both actions require the CSRF header (the shell sends it), write
audit rows, and 404 cleanly when the member has no earned row. Loading, empty, error, and
populated states all render.
**Result:** web ☐ mobile ☐ — notes:

### CA-A3 · Config editor
**Role:** admin · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Edit threshold, the four minimums, and several per-event weights (the fixed fifteen-key list —
   one labeled numeric input each); save.
2. Try a negative number and a non-number.
3. Look at the channel-open toggle.
**Expected:** Valid saves persist and reload; invalid values are refused with a plain message
(client-side and again server-side — the route rejects unknown weight keys and negative numbers).
**Result:** web ☐ mobile ☐ — notes:

### CA-A4 · Channel launch gate and status card
**Role:** admin · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. With the eligible count BELOW `min_eligible_to_open_channel`: look at the channel-open toggle,
   then try to force it anyway with a direct
   `PUT /api/contributor-access/admin/config` carrying `{"channelOpen": true}`.
2. Lower `min_eligible_to_open_channel` to at or below the current eligible count, save, and flip
   the toggle on.
3. Read the status card in both states.
**Expected:** Below the minimum the toggle is disabled with the explanatory note (locked until N
members are eligible), and the direct API call is refused with 409 and the stable code
`contributor_access_channel_below_minimum` (the deny lands in the audit trail) — the client is
never trusted. At or above the minimum the toggle works; saving open creates the Stream channel
and runs the first membership sync. The status card shows `eligible / needed`, the OPEN/CLOSED
badge, and (when open and Stream is configured) the synced member count; closing an open channel
is always allowed.
**Result:** web ☐ mobile ☐ — notes:

### CA-A5 · Internal recompute route
**Role:** operator with `INTERNAL_SERVICE_SECRET` · **Surfaces:** API only
**Steps:**
1. `POST /api/internal/contributor-access/recompute` with no auth header, a wrong bearer, and the
   real bearer.
2. Run it twice in a row.
**Expected:** 501 when the secret is unconfigured; 401 on a missing/wrong bearer; 200 with
`{ ok, evaluated, eligible }` counts only (no per-member data) on the real bearer. A second run is
safe (idempotent upserts). A member who was eligible before the run is still eligible after —
recompute never revokes. The weekly workflow (`contributor-access-recompute.yml`, Mondays
06:30 UTC + manual dispatch) calls this same route.
**Result:** api ☐ — notes:

---

## Gated channel walkthrough (member surface)

> Precondition for all cases: the channel is open (`channel_open` TRUE — see CA-A4) and the
> one-time Stream channel-type script has run for this environment (only needed for the live
> layer; polling works without it).

### CA-C1 · Non-eligible member sees nothing, anywhere
**Role:** signed-in member WITHOUT the eligibility flag · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Open the Commons. Inspect the desktop channel rail and the phone-width chat section.
2. Call `GET /api/hub/channels` and each `/api/contributor-access/channel/...` route directly.
**Expected:** Only `#general` in the rail; at phone widths NO channel switch row renders (it only
exists with more than one channel). The channels payload has no `contributors` entry. Every
channel route answers a bare 404 with no channel name, no "locked", no "you need X" — nothing
that reveals the channel exists. There is no teaser on any surface. On Android, the Commons
renders exactly as it ships today — no channel pill row exists at all (it only renders when the
server-filtered channel list carries the contributors entry).
**Result:** web ☐ mobile ☐ — notes:

### CA-C2 · Eligible member: sees, posts, threads, reacts — no image upload
**Role:** eligible member · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Open the Commons: pick `#contributors` (desktop rail; phone-width pill row).
2. Post a message; reply to an existing message (Reply → send); toggle reactions, opening the
   picker to view the full set.
3. Try to attach an image by any means (look for any attach/upload affordance; paste an image
   into the composer).
4. Write a long message (over 1200 characters, under 4000) and send it.
**Expected:** The channel renders with the Commons look. Posting works; the reply renders with the
quoted block (thread), and **tapping that quoted block on web scrolls to the original message and
briefly highlights it** (the same jump the Commons has; on Android the quoted block is not yet
tappable — tracked parity gap). The reaction picker offers the twelve-emoji gated set (richer than the
Commons' six) and toggling works. There is NO image/file affordance anywhere and pasting an image
does nothing — text only. The long message sends (the gated cap is 4000, higher than the Commons'
1200). With a second eligible account: a new post appears on the other screen within the poll
interval (or instantly when the live layer is connected, with typing indicators). On Android, the
Commons header gains a `#general` / `#contributors` pill row; picking `#contributors` opens the
channel with the same behavior (post, quoted reply, twelve-emoji reaction picker, no upload
affordance, 4000-character composer limit; polling only — no typing indicators on Android).
**Result:** web ☐ mobile ☐ — notes:

### CA-C3 · Moderator disclosure is plainly visible
**Role:** eligible member (and an admin) · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Open `#contributors` and read the header area and the composer footnote.
2. As an admin (without the eligibility flag): confirm the channel is listed and readable.
**Expected:** The header carries "Moderators can read this channel." at all widths, always — not
in a tooltip, not behind a tap; the composer footnote repeats it. The admin can open and read the
channel (that read access is exactly what the disclosure line discloses). Android shows the same
line in the channel header and repeats it under the composer.
**Result:** web ☐ mobile ☐ — notes:

### CA-C4 · Revoke removes the member from the channel
**Role:** admin + the revoked member · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. With the channel open, revoke an eligible member for cause (CA-A2 flow).
2. As that member: reload the Commons; call the channel routes directly.
3. Reinstate the member and re-check.
**Expected:** After the revoke, the member's channel entry is gone from `/api/hub/channels`, the
channel routes answer a bare 404, and the Stream membership sync has removed them from
`ctf-contributors` (the admin status card's member count drops). No teaser remains — their Commons
looks exactly like a never-eligible member's. Reinstating restores the entry and access. A Stream
outage during revoke/reinstate never blocks the action itself (the response carries a
`channelSyncWarning` and membership reconciles on the next sync). On Android, a 404 mid-session
silently drops the pill row and lands the member back on the Commons — no error banner, no retry
loop.
**Result:** web ☐ mobile ☐ — notes:

### CA-C5 · Posting rate limit (same threshold as the Commons)
**Role:** eligible member · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. In `#contributors`, post 8 short messages inside a few minutes.
2. Post a 9th.
3. Wait past the window (or use a second account) and post again.
**Expected:** The first 8 send. The 9th is refused with the same error-banner state the Commons
shows when its posting limit trips (the route answers 429 with the stable code
`rate_limit_exceeded`); nothing is stored for it. Deleting one of your posts does NOT free a slot
(deleted rows still count toward the window). After the 30-minute window passes, posting works
again. Android shows the refusal as the same send-error line the Commons uses ("You are posting
too quickly…").
**Result:** web ☐ mobile ☐ — notes:

### CA-C6 · Content gate — a blocked post is never shown to anyone
**Role:** eligible member + a second eligible account · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Try to post a message containing raw angle-bracket markup (e.g. `<script>hello</script>`).
2. Try to post a message containing four or more `https://` links.
3. On the second account, watch the channel during and after both attempts.
**Expected:** Both posts are refused with a visible moderation message (the route answers 422
with the stable code `content_policy_violation`) — the same content gate the Commons runs on
community posts. Neither post is ever stored, so the second account never sees them, not even
briefly; the composer keeps the text so the member can fix and resend. Android surfaces the same
moderation message on refusal.
**Result:** web ☐ mobile ☐ — notes:

### CA-C7 · Delete — author-only, admin-any, gone for good
**Role:** two eligible members + an admin · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. As member A: post a message; confirm a Delete action shows on your own message but NOT on
   member B's messages; delete your message (a confirm step must appear).
2. As member A: call `DELETE /api/contributor-access/channel/messages/[postId]` directly on one
   of member B's posts.
3. As the admin: confirm the Delete action shows on every message; delete one of member B's
   posts (confirm step again).
4. On every account: hard-refresh the channel and re-read
   `GET /api/contributor-access/channel/messages`.
**Expected:** The member's own delete works after the confirm and the message disappears
everywhere (both accounts, within the poll interval). The direct API attempt on someone else's
post is refused with 403 and changes nothing (the denied attempt lands in
`contributor_access_audit_trail`). The admin can delete any message — that is the disclosed
moderator power — and the removal is audited under the distinct moderator command. Deleted
messages stay gone after refresh and re-login (soft delete: `deleted_at`/`deleted_by` set,
content excluded from every read, and a reply that quoted a deleted message shows no quoted
block). Reacting to or replying to a deleted message answers 404/400. On Android, the Delete
action shows only on the member's own messages and is confirm-gated (system dialog); the admin
delete-any affordance is web-only for now (the server still enforces admin delete on the API).
**Result:** web ☐ mobile ☐ — notes:

### CA-C8 · Edit — delete + repost, no history rewrite
**Role:** eligible member + a second eligible account · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. As member A: post a message; confirm an Edit action shows on your own message but NOT on
   member B's messages.
2. Tap Edit: confirm the original message is deleted and its text is loaded into the composer.
3. Change the text and send the fresh message.
4. On the second account: read the channel and re-read `GET /api/contributor-access/channel/messages`.
**Expected:** There is no in-place edit — tapping Edit deletes the original (it disappears
everywhere within the poll interval) and drops its text into the composer. The reposted message
is a brand-new message with a new id and a new timestamp; the original's timestamp is not
carried over and its history is not rewritten. The second account sees the original vanish and the
new message appear. Edit shows only on the member's own messages.
**Result:** web ☐ mobile ☐ — notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps & Known Technical Debt" section:

- One-time owner step per Stream app: run `ctf/scripts/setupGatedChannelType.mjs` (production and
  staging) before the live layer/channel config exists in Stream; until then opening the channel
  returns a `channelSyncWarning`.
- Android parity shipped 2026-07-19 (#1680 badge, #1681 channel). Remaining android deltas
  (deliberate): no live typing indicators (polling only), no admin delete-any affordance in the
  RN channel UI (server-enforced on the API), and the "how it's earned" explainer is condensed
  into the badge dialog instead of a separate page.
- No in-place message edit in the gated channel (deliberate). Edit is delete + repost: the Edit
  action pulls the text into the composer, deletes the original, and the member sends a fresh
  message with a new timestamp — history is never rewritten. Same behavior as the Commons.
- Default weights/threshold are a starting point pending owner tuning.
- Active blocks/safety reports are not yet an admission gate (owner decision pending).
