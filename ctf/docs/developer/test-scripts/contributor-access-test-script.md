# Contributor Access — Manual Test Script

> Generated from the feature inventory and plugin contracts; this is the runnable checklist for the Contributor Access plugin. To regenerate: `pnpm --dir ctf test-script:generate -- contributor-access`

| Field | Value |
|---|---|
| **Plugin** | Contributor Access (`contributor-access`) |
| **Visibility** | Member |
| **Roles to test** | admin, member |
| **Surfaces** | Web (desktop), Web (mobile-responsive) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-contributor-access-feature-inventory.md` |
| **Generated** | 2026-08-05 (commit efb8d7710) |

> **Android note:** The Android (React Native) surface was removed 2026-07-20 (rule 105, PR #1742). This plugin is web-only. No android checkboxes appear in this script.

---

## How to run this

- Mark each check **✅ pass**, **❌ fail**, or **⛔ blocked** as you go.
- A **❌** becomes a row in the Bug Reporting plugin — note the case ID, what you expected, and what actually happened.
- Run **Core smoke** at the start of every test session before anything else.
- "Web" means desktop browser unless the step says "narrow the browser to phone width" — do that for mobile-responsive checks.

---

## Core smoke (every session)

1. Sign in as an **admin**. Go to `/admin/contributor-access`. The page loads — no redirect, no blank screen, no unhandled error. web ☐
2. Go to `/apps/directory`. Open any **claimed** Directory profile that the seed data marks as a badge holder. The "Weavers of the Commons" braid badge renders next to the member's name. web ☐
3. Go to `/apps/directory/weavers-of-the-commons` while signed in as a **member**. The explainer page loads — no redirect, no error. web ☐
4. Sign out, then navigate directly to `/apps/directory/weavers-of-the-commons`. You are redirected to `/apps/directory` — the page does not render. web ☐
5. Sign in as an **eligible member** (one whose eligibility flag is set in the seed data or set manually via the admin panel). Open the Commons. The `#contributors` channel appears in the channel list alongside `#general`. web ☐

---

## Member walkthrough

### CA-1 — Badge renders on a claimed, eligible profile
**Role:** member (signed in) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** At least one member in the seed data has `eligible = TRUE` and `revoked_for_cause = FALSE` and has a **claimed** Directory profile. Sign in as any member.

**Steps:**
1. Go to `/apps/directory`.
2. Open the claimed profile of the eligible badge holder.
3. Look at the area next to the member's name.

**Expected:** The "Weavers of the Commons" braid emblem (rust circle, cream/gold three-strand braid) is visible next to the name. No score, no date, no points label appears anywhere on the profile.

Result: web ☐ mobile-responsive ☐

---

### CA-2 — Badge does not render on a non-eligible profile
**Role:** member (signed in) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** At least one member in the seed data is either not eligible or has `revoked_for_cause = TRUE`, and has a claimed profile.

**Steps:**
1. Go to `/apps/directory`.
2. Open the claimed profile of a non-eligible or revoked member.
3. Look next to the member's name.

**Expected:** No badge, no empty badge slot, no lock icon, no "not yet earned" text. The name area looks identical to what it would look like if the badge feature did not exist.

Result: web ☐ mobile-responsive ☐

---

### CA-3 — Badge does not render on an unclaimed (community-generated) profile
**Role:** member (signed in) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** At least one unclaimed (community-generated) Directory profile exists in the seed data.

**Steps:**
1. Go to `/apps/directory`.
2. Open an unclaimed profile.
3. Look next to the name.

**Expected:** No badge field of any kind. The profile layout is unchanged.

Result: web ☐ mobile-responsive ☐

---

### CA-4 — Badge click-through dialog content
**Role:** member (signed in) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** A claimed, eligible profile is visible (same as CA-1).

**Steps:**
1. Open the eligible member's Directory profile.
2. Click the "Weavers of the Commons" badge.
3. Read the dialog that opens.

**Expected:**
- Title is exactly "Weavers of the Commons".
- Body copy says this member is a consistent, broad contributor — real help delivered over time — and that anyone can earn it.
- A "How it's earned" link is present.
- The copy does not use the words "verified", "vetted", or "trusted by the platform".
- No score or numeric value appears anywhere in the dialog.

Result: web ☐ mobile-responsive ☐

---

### CA-5 — "How it's earned" link navigates to the explainer page
**Role:** member (signed in) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** The badge dialog from CA-4 is open.

**Steps:**
1. Click the "How it's earned" link inside the dialog.
2. Observe where you land.

**Expected:** You arrive at `/apps/directory/weavers-of-the-commons`. The page loads in the Directory shell. No redirect occurs.

Result: web ☐ mobile-responsive ☐

---

### CA-6 — Explainer page content
**Role:** member (signed in) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** Signed in as any member. Navigate to `/apps/directory/weavers-of-the-commons`.

**Steps:**
1. Read the full page.

**Expected:**
- The page explains that the badge is earned by steadily delivering real help to other members across the platform.
- It states the badge is permanent once earned.
- It states there is no application and no way to buy it.
- It states no score is shown anywhere.
- It mentions the same standing opens the members-only channel in the Commons and the private room in Chyme.
- No numeric score, tier, leaderboard, or ranking appears anywhere on the page.

Result: web ☐ mobile-responsive ☐

---

### CA-7 — Explainer page requires sign-in
**Role:** signed-out visitor | **Surfaces:** web (desktop)

**Precondition:** Sign out completely.

**Steps:**
1. Navigate directly to `/apps/directory/weavers-of-the-commons`.

**Expected:** You are redirected to `/apps/directory`. The explainer page does not render for unauthenticated visitors.

Result: web ☐

---

### CA-8 — Non-eligible member does not see the #contributors channel
**Role:** member (signed in, not eligible) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** Sign in as a member who is **not** eligible (no row in `contributor_access_eligibility` with `eligible = TRUE` and `revoked_for_cause = FALSE`).

**Steps:**
1. Open the Commons (`/apps/commons` or however the app routes to it).
2. Look at the full channel list / channel rail.

**Expected:**
- `#contributors` does not appear anywhere in the channel list.
- There is no locked entry, no grayed-out entry, no "members only" teaser, no gap in the list — the layout is identical to that of a Commons with only `#general`.

Result: web ☐ mobile-responsive ☐

---

### CA-9 — Non-eligible member gets a bare 404 from the channel API
**Role:** member (signed in, not eligible) | **Surfaces:** web (desktop)

**Precondition:** Same sign-in as CA-8.

**Steps:**
1. Open browser developer tools (Network tab).
2. Make a GET request to `/api/contributor-access/channel/messages` (you can do this by pasting the URL in the address bar while developer tools are open, or by using fetch in the console).

**Expected:** The server returns **404**. The response body contains no text, name, or identifier that reveals the channel exists. No 401, no 403, no channel name in an error message.

Result: web ☐

---

### CA-10 — Eligible member sees the #contributors channel
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** Sign in as a member with `eligible = TRUE` and `revoked_for_cause = FALSE`. The channel must be open (`channel_open = TRUE`) — confirm in the admin panel first (CA-A4). If `channel_open` is FALSE, set it to TRUE via CA-A5 first (requires enough eligible members).

**Steps:**
1. Open the Commons.
2. Look at the channel list.

**Desktop expected:** `#contributors` appears in the channel rail alongside `#general`.

**Mobile-responsive expected:** A channel-pill switch row appears in the chat section showing both `#general` and `#contributors`. (This row only appears when the member has more than one channel.)

**API edge (optional, developer tools):** opening the channel still connects the live layer normally — the client's join call sends the `x-ctf-csrf: '1'` header. A bare `fetch('/api/contributor-access/channel/join', {method: 'POST'})` from the dev-tools console **without** that header is refused (the CSRF deny), the same posture as every other mutation in this plugin (2026-08-06 fix, issue #2122).

Result: web ☐ mobile-responsive ☐

---

### CA-11 — Channel moderator disclosure is always visible
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** Same as CA-10; `#contributors` channel is accessible.

**Steps:**
1. Open the `#contributors` channel.
2. Look at the channel header.
3. Look below the message composer.

**Expected:** The text "Moderators can read this channel." is visible in the channel header. The same (or equivalent) disclosure also appears in the composer footnote area. This text is always present — it does not disappear after you read it.

Result: web ☐ mobile-responsive ☐

---

### CA-12 — Post a message in the gated channel
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** Same as CA-10.

**Steps:**
1. Open the `#contributors` channel.
2. Type a short plain-text message (e.g. "Hello from the test run") and send it.
3. Observe the message list.

**Expected:** The message appears in the channel immediately. No image upload button or file attachment control is present anywhere in the composer.

Result: web ☐ mobile-responsive ☐

---

### CA-13 — Message character limit is 4000, not 1200
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop)

**Precondition:** Same as CA-10.

**Steps:**
1. Open the `#contributors` channel composer.
2. Paste or type exactly 4000 characters of plain text.
3. Send the message.
4. Observe the result.
5. Now try to send a message that is 4001 characters.

**Expected:** The 4000-character message sends successfully and appears in the channel. The 4001-character message is rejected (either the composer prevents it or the server returns an error) — it does not appear in the channel.

Result: web ☐

---

### CA-14 — Content gate blocks raw angle-bracket markup
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop)

**Precondition:** Same as CA-10.

**Steps:**
1. Open the `#contributors` channel composer.
2. Type a message containing a raw HTML tag, e.g. `Hello <script>alert(1)</script>`.
3. Attempt to send.

**Expected:** The server returns a 422 error. The message is not stored and does not appear in the channel. The UI shows the same error banner the Commons shows for a content policy violation. No partial or mangled version of the message appears.

Result: web ☐

---

### CA-15 — Content gate blocks more than three links
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop)

**Precondition:** Same as CA-10.

**Steps:**
1. Open the `#contributors` channel composer.
2. Type a message containing four URLs (e.g. `https://a.com https://b.com https://c.com https://d.com`).
3. Attempt to send.

**Expected:** The server returns 422. The message is not stored, does not appear in the channel, and the UI shows the content policy error banner.

Result: web ☐

---

### CA-16 — Rate limit at 8 posts per 30 minutes
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop)

**Precondition:** Same as CA-10. The test member has not posted in the last 30 minutes (or use a fresh seed / a fresh test account).

**Steps:**
1. Send 8 plain-text messages in rapid succession (each must pass the content gate — no markup).
2. Attempt to send a 9th message within the same 30-minute window.

**Expected:** Messages 1–8 appear in the channel. The 9th attempt is rejected with a 429 error. The UI shows the same rate-limit error banner the Commons shows (`rate_limit_exceeded`). The 9th message does not appear in the channel.

**API edge (optional, developer tools):** while over the window, a POST to `/api/contributor-access/channel/messages` with an unknown `replyToPostId` still returns the 429 `rate_limit_exceeded` — the rate limit is checked before the reply-target lookup, so the reply id cannot change which error comes back (2026-08-05 fix, issue #2121).

Result: web ☐

---

### CA-17 — Quoted (threaded) reply
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** Same as CA-10. At least one message exists in the channel.

**Steps:**
1. Hover over (or long-press on mobile) an existing message and choose the reply / quote action.
2. Type a reply and send it.
3. Observe the new message in the channel.

**Expected:** The new message shows a quoted block referencing the original message. The quoted block is presented as a button that, when clicked, scrolls to and highlights the original message (web). The reply is stored and visible to other eligible members when they load the channel.

Result: web ☐ mobile-responsive ☐

---

### CA-18 — Reaction toggle — gated emoji set
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** Same as CA-10. At least one message exists in the channel.

**Steps:**
1. Open the reaction picker on a message.
2. Count the available emojis.
3. Add one reaction.
4. Click the same emoji again (toggle off).

**Expected:** Exactly 12 emojis are available (more than the Commons' 6). Adding the reaction shows it on the message with a count. Clicking it again removes your reaction (count decreases or disappears). No emoji outside the fixed gated set can be submitted.

**API edge (optional, developer tools):** a POST to `/api/contributor-access/channel/messages/not-a-uuid/reactions` with a valid emoji returns a 404 ("That message is no longer available."), not a 503 — a malformed post id is treated as not-found (2026-08-06 hardening, issues #2125/#2127).

Result: web ☐ mobile-responsive ☐

---

### CA-19 — Author can delete their own message
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** Same as CA-10. Post a new message as the test member.

**Steps:**
1. Hover over (or long-press on mobile) the message you just posted.
2. Choose the Delete action.
3. Confirm the deletion in the confirmation dialog.
4. Observe the message list.

**Expected:** The message disappears from the channel. It is no longer visible to the author or any other member loading the channel. (Internally it is soft-deleted — the row still exists — but no user-facing surface shows it.)

Result: web ☐ mobile-responsive ☐

---

### CA-20 — Author cannot delete another member's message
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop)

**Precondition:** Same as CA-10. At least one message in the channel was posted by a **different** eligible member (post one yourself as member A, then sign in as member B).

**Steps:**
1. Sign in as member B (eligible, not the author of member A's message).
2. Open the `#contributors` channel.
3. Hover over member A's message.

**Expected:** No Delete action is available for member B on member A's message. If the action is somehow invoked (e.g. via a direct API call), the server returns 403 and the message remains visible.

Result: web ☐

---

### CA-21 — Edit action on own message (delete + repost flow)
**Role:** member (signed in, eligible) | **Surfaces:** web (desktop)

**Precondition:** Same as CA-10. Post a message as the test member.

**Steps:**
1. Hover over your own message and choose the Edit action.
2. The composer loads with the original text.
3. Change the text and send.
4. Observe the channel.

**Expected:** The original message is removed from the channel. A new message with the updated text appears. The new message has a new timestamp. No in-place edit occurred — it is a fresh post. No edit action appears on another member's message.

Result: web ☐

---

## Admin walkthrough

### CA-A1 — Admin page access gate
**Role:** admin, then member | **Surfaces:** web (desktop)

**Precondition:** Have both an admin account and a plain member account available.

**Steps:**
1. Sign in as **admin**. Navigate to `/admin/contributor-access`.
2. Confirm the page loads.
3. Sign out. Sign in as a plain **member**. Navigate to `/admin/contributor-access`.

**Expected:** Admin sees the full Contributor Access admin shell — eligible members section, config editor, and channel status card. The member is redirected to `/apps` and never sees admin content.

Result: web ☐

---

### CA-A2 — Eligible members list shows categorical data only
**Role:** admin | **Surfaces:** web (desktop)

**Precondition:** At least one member is eligible (seed data or manually triggered). Sign in as admin. Go to `/admin/contributor-access`.

**Steps:**
1. Look at the eligible members section.
2. Check every column and data point displayed per member.

**Expected:** Each row shows user ID (or username), first-earned date, and revoke flag/reason. **No score, no numeric point total, no per-event counts, no reason_snapshot data appears anywhere** — not in a tooltip, not in a collapsed section. The list is categorical only.

Result: web ☐

---

### CA-A3 — For-cause revoke requires a non-empty reason
**Role:** admin | **Surfaces:** web (desktop)

**Precondition:** At least one eligible member is listed. Sign in as admin.

**Steps:**
1. Go to `/admin/contributor-access`, eligible members section.
2. Click Revoke on an eligible member.
3. Leave the reason field empty and attempt to confirm.
4. Then enter a reason (e.g. "Test revocation — this is a manual test run") and confirm.

**Expected:** With an empty reason, the revoke does not proceed — the UI shows a validation error or the confirm button is disabled. With a non-empty reason and confirmation, the revoke succeeds, the member is marked revoked, and their revoked status is visible in the list.

Result: web ☐

---

### CA-A4 — Revoked member loses channel access and badge
**Role:** admin (to revoke), then member (to verify) | **Surfaces:** web (desktop)

**Precondition:** An eligible member with a claimed Directory profile has been revoked per CA-A3. The channel is open.

**Steps:**
1. Sign in as the revoked member.
2. Open the Commons and look at the channel list.
3. Navigate to `/api/contributor-access/channel/messages` (or attempt to use the channel UI).
4. Open the revoked member's Directory profile.

**Expected:**
- `#contributors` does not appear in the channel list. No locked teaser is shown.
- The channel API returns a bare 404 with no channel trace.
- The "Weavers of the Commons" badge does not appear on the Directory profile. No empty badge slot renders.

Result: web ☐

---

### CA-A5 — Reinstate restores channel access and badge
**Role:** admin (to reinstate), then member (to verify) | **Surfaces:** web (desktop)

**Precondition:** The member revoked in CA-A3/CA-A4 is still revoked. The channel is open.

**Steps:**
1. Sign in as admin. Go to `/admin/contributor-access`.
2. Click Reinstate on the revoked member. Confirm.
3. Sign in as the reinstated member.
4. Open the Commons.
5. Open the reinstated member's Directory profile.

**Expected:** The reinstate succeeds. The member can now see `#contributors` in the channel list. The "Weavers of the Commons" badge reappears on their Directory profile. The `first_earned_at` date in the admin list is unchanged (it was not reset by the revoke/reinstate cycle).

Result: web ☐

---

### CA-A6 — Admin can read the gated channel (moderator read access)
**Role:** admin | **Surfaces:** web (desktop)

**Precondition:** The channel is open and contains at least one message.

**Steps:**
1. Sign in as admin (the admin does not need the eligibility flag).
2. Open the Commons. Look for `#contributors` in the channel list.
3. Open the channel and read the messages.

**Expected:** `#contributors` is visible to the admin in the channel list. The admin can read all messages. The moderator disclosure ("Moderators can read this channel.") is present in the channel header, consistent with what eligible members see (CA-11).

Result: web ☐

---

### CA-A7 — Admin can delete any member's message (moderator delete)
**Role:** admin | **Surfaces:** web (desktop)

**Precondition:** The channel is open and contains a message posted by a member (not the admin).

**Steps:**
1. Sign in as admin. Open the `#contributors` channel.
2. Hover over a message posted by a member and choose the Delete action.
3. Confirm the deletion.
4. Observe the channel.

**Expected:** The message disappears from the channel. It is no longer visible to any user loading the channel. The admin's delete is a soft delete (the row is retained internally with `deleted_by` set). This is a distinct audit path from an author self-delete (tracked internally as `contributor-access.channel.post.moderator-delete`).

Result: web ☐

---

### CA-A8 — Config editor loads with current values
**Role:** admin | **Surfaces:** web (desktop), web (mobile-responsive)

**Precondition:** Sign in as admin. Go to `/admin/contributor-access`.

**Steps:**
1. Open the config editor section.
2. Note the visible fields.

**Expected:** The editor shows: score threshold, minimum account age (days), minimum distinct plugins, minimum distinct counterparties, minimum eligible members to open channel, and per-event weight overrides. It also shows the channel open/closed toggle and the channel status card (eligible count vs minimum, OPEN/CLOSED badge, synced Stream member count or "unavailable"). All values match the system defaults (threshold 100, age 90 days, 3 plugins, 5 counterparties, 10 min eligible) if the config has never been written.

Result: web ☐ mobile-responsive ☐

---

### CA-A9 — Config update saves successfully
**Role:** admin | **Surfaces:** web (desktop)

**Precondition:** Sign in as admin. Go to `/admin/contributor-access`, config editor.

**Steps:**
1. Change the score threshold to a new value (e.g. 95).
2. Save.
3. Reload the page and reopen the config editor.

**Expected:** The saved threshold value (95) is shown on reload. The update did not error. The channel open state is unchanged.

Result: web ☐

---

### CA-A10 — Channel open toggle is launch-gated below the minimum
**Role:** admin | **Surfaces:** web (desktop)

**Precondition:** Sign in as admin. The eligible count is below `min_eligible_to_open_channel` (default 10). If the seed data produces fewer than 10 eligible members, this condition should hold naturally.

**Steps:**
1. Go to `/admin/contributor-access`, config editor.
2. Observe the channel toggle.
3. Attempt to turn the channel open toggle ON and save.

**Expected:** The toggle is locked or carries an explanatory note indicating the channel cannot open until the eligible count reaches the minimum. If the toggle is somehow enabled and the save is sent, the server returns **409** with the stable code `contributor_access_channel_below_minimum`. The channel state remains closed. The channel status card shows the current eligible count vs the required minimum.

Result: web ☐

---

### CA-A11 — Channel open toggle works once the minimum is met
**Role:** admin | **Surfaces:** web (desktop)

**Precondition:** The eligible count meets or exceeds `min_eligible_to_open_channel`. (Lower the minimum via the config editor if needed — set it to 1, save, then try the open toggle. Remember to restore it after the test.) The channel is currently closed.

**Steps:**
1. Go to `/admin/contributor-access`, config editor.
2. Set `minEligibleToOpenChannel` to 1 (if eligible count is low) and save.
3. Turn the channel open toggle ON and save.

**Expected:** The save succeeds. The channel status card shows **OPEN**. Eligible members can now see `#contributors` in the Commons (verify with CA-10 using an eligible member account). A `channelSyncWarning` may appear if Stream is not configured in the demo environment — that is expected and is not a failure of the config save itself.

Result: web ☐

---

### CA-A12 — Closing an open channel is always allowed
**Role:** admin | **Surfaces:** web (desktop)

**Precondition:** The channel is currently open (CA-A11 completed). Sign in as admin.

**Steps:**
1. Go to `/admin/contributor-access`, config editor.
2. Turn the channel open toggle OFF and save.
3. Sign in as an eligible member and open the Commons.

**Expected:** The save succeeds immediately with no minimum-check error — closing is unconditional. The eligible member no longer sees `#contributors` in the channel list. The channel API returns a bare 404. The channel status card shows **CLOSED**.

Result: web ☐

---

### CA-A13 — Operations role cannot access the admin page
**Role:** user with `operations` role only | **Surfaces:** web (desktop)

**Precondition:** A user account exists with the `operations` role but not `admin`. If the seed data does not provide one, skip this case and note it as blocked.

**Steps:**
1. Sign in as the operations-role user.
2. Navigate to `/admin/contributor-access`.

**Expected:** The user is redirected to `/apps`. No admin content renders.

Result: web ☐

---

## Parity check (web ↔ android)

Android was removed on 2026-07-20 (rule 105, PR #1742). There is no Android surface to compare. All parity checks in this script are web desktop ↔ web mobile-responsive only.

| Case | What must match across desktop and mobile-responsive |
|---|---|
| CA-1 | Badge renders on eligible claimed profile |
| CA-2 | Badge absent on non-eligible profile (no empty slot) |
| CA-3 | Badge absent on unclaimed profile |
| CA-4 | Dialog title, body copy, link — identical content |
| CA-8 | Non-eligible member sees no channel entry, no teaser |
| CA-10 | Eligible member sees `#contributors` (pill row on mobile, rail on desktop) |
| CA-11 | Moderator disclosure text present in header and composer footnote |
| CA-12 | Post sends; no upload affordance in composer |
| CA-17 | Quoted reply renders with quote block |
| CA-18 | Reaction picker shows 12 emojis; toggle works |
| CA-19 | Author can delete own message with confirmation |
| CA-A8 | Config editor fields and channel status card visible |

---

## Known gaps — do not file these as bugs

- **One-time Stream setup not done:** The `ctf-gated` channel type must be created manually by running `ctf/scripts/setupGatedChannelType.mjs` against the staging credentials before the channel can be created on Stream. If the channel open toggle succeeds but returns a `channelSyncWarning`, and Stream membership is not visible, this is the likely cause — not a code bug.
- **Default weights not owner-tuned:** The shipped `DEFAULT_WEIGHTS` are a starting point. Members may or may not reach eligibility in the seed data depending on the demo data volume. Adjust `minEligibleToOpenChannel` downward in the config editor for local testing if needed.
- **Clean-standing gate is partial:** Active blocks and safety reports are not yet read as an admission gate. A member with an active block could be eligible. This is a tracked gap pending an owner decision, not a bug.
- **No per-member admin drill-down:** The admin eligible list shows no breakdown of how a member earned eligibility (no score, no per-event view). This is intentional.
- **Quoted-reply jump not available on mobile-responsive:** Clicking the quoted block to scroll to the original message is web (desktop) only. The mobile-responsive quoted block displays the reference but is not yet a tappable scroll target.
- **No message edit on mobile-responsive:** The Edit (delete + repost) action is confirmed on web desktop. Mobile-responsive parity for the edit action is not tracked as a separate gap in the inventory — verify whether it surfaces in the mobile layout during CA-21, but do not file if absent (it is not listed as a completed mobile feature).
- **`CONTRIBUTOR_ACCESS_PROFILE_AND_DELETION_CONTRACT.md` not yet authored:** The deletion behavior is wired, but the standalone contract document is still outstanding. Do not file this as a bug.
