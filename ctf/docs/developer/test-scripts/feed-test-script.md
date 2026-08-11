# Commons (Feed & Announcements) — Manual Test Script

> Generated from the feature inventory and contracts for the `feed` plugin; this is the runnable checklist for a human tester on a real device. To regenerate: `pnpm --dir ctf test-script:generate -- feed`

| Field | Value |
|---|---|
| **Plugin** | Commons (Feed & Announcements) |
| **Visibility** | member |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop + mobile-responsive) — Android surface removed 2026-07-20 |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-feed-feature-inventory.md` |
| **Generated** | 2026-08-11 (commit 9f75d551a) |

---

## How to run this

- Mark each surface checkbox as you go: ✅ pass / ❌ fail / ⛔ blocked
- A ❌ on any check becomes a row in the Bug Reporting plugin — record the case ID, surface, steps, and what you actually saw
- Run **Core smoke** at the start of every test session before anything else
- The seed command must complete without errors before you start; if it errors, stop and fix it first

---

## Core smoke (every session)

**CS-1. Commons loads for a signed-in member**
Open the app as a seeded member. Navigate to the home/Hub page.
Confirm the Commons chat area is visible, contains at least one message, and does not show an unhandled error.
web ☐

**CS-2. Timeline has content across all three channels**
Still signed in as a member. In the Commons, confirm you can see items that came from at least two different types: an announcement (has a shield/official badge or is from the operator), a community post (from a member), or a Q&A item.
web ☐

**CS-3. Admin surface loads**
Sign in as an admin. Navigate to `/admin/feed-announcements`.
Confirm the page header reads **Commons: Feed & Announcements Admin** (not "Feed Announcements" or "Feed & Announcements Admin" without the "Commons:" prefix).
web ☐

**CS-4. Signed-out public view**
Sign out completely. Navigate to the home page.
Confirm community posts are visible to a signed-out visitor. Confirm you cannot post without signing in.
web ☐

---

## Member walkthrough

### FD-1. Channel filter — all / announcements / questions / community

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member. At least one seeded announcement, one question, and one community post exist.

**Steps:**
1. Go to the Commons / Hub home.
2. If channel filter tabs or controls are visible, select "Announcements only."
3. Confirm only announcement-type items appear.
4. Select "Questions."
5. Confirm only Q&A items appear.
6. Select "Community."
7. Confirm only peer community posts appear.
8. Select "All."
9. Confirm items from multiple types appear together.

**Expected:** Each filter shows only the matching item type. "All" shows everything. No filter crashes the page or shows an error state.

**Result:** web ☐

---

### FD-2. Mark a feed item as read

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member. At least one unread feed item is visible.

**Steps:**
1. Identify a feed item that is visually unread (bold, dot, or highlighted — whatever the unread indicator is).
2. Open or click it so the app registers a read event.
3. Reload the page.
4. Find the same item.

**Expected:** After reload the item no longer shows the unread indicator. The action is idempotent — doing it twice does not cause an error.

**Result:** web ☐

---

### FD-3. Dismiss an announcement

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member. At least one published announcement is visible in the feed.

**Steps:**
1. Find a published announcement card.
2. Click/tap the dismiss control (X, "dismiss", or equivalent).
3. Confirm the announcement disappears from view.
4. Reload the page.
5. Confirm the announcement does not reappear.

**Expected:** The announcement is gone after dismiss and stays gone after reload. No 409 "cannot dismiss" error appears — every announcement is dismissable.

**Result:** web ☐

---

### FD-4. First-visit notice appears once, then is gone

**Role:** member (a fresh member who has not yet seen the notice)  
**Surfaces:** web  
**Precondition:** Use a seeded member account that has not visited the Commons before, or clear the `feed_commons_notice_seen` entry for the test account. If neither is practical, skip and note as blocked.

**Steps:**
1. Sign in as that member and navigate to the Commons.
2. Confirm a first-visit notice card appears above or near the message list. It should be short — something about the room being public and the assistant not being a substitute for professional help.
3. Dismiss or acknowledge the notice.
4. Reload the page.
5. Confirm the notice does not appear again.

**Expected:** Notice appears once on first visit. It is compact — it does not push the message list off screen. After dismissal it does not reappear on reload.

**Result:** web ☐

---

### FD-5. Post a community message (member cap)

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member.

**Steps:**
1. Go to the Commons composer.
2. Type a message under 1,200 characters with no HTML tags.
3. Submit it.
4. Confirm the message appears in the chat.
5. Now type a message that is longer than 1,200 characters (paste repeated text to go over).
6. Confirm the composer shows a character counter in the last 150 characters, and past the limit shows **exactly how many characters to remove**.
7. Confirm the send button is disabled while over the limit.
8. Try to force-submit if possible.

**Expected:** Short post succeeds and appears immediately. Over-limit: counter appears, send button is disabled, and if a submit is forced the API returns a 400 that names the overage rather than a generic error. The typed text is NOT destroyed on a failed send.

**Result:** web ☐

---

### FD-6. Post with raw HTML is rejected

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member.

**Steps:**
1. In the Commons composer, type a message containing `<b>bold</b>`.
2. Submit it.

**Expected:** The server rejects the post with an error. The post does not appear in the Commons. The composer text is preserved so the member can edit and resubmit.

**Result:** web ☐

---

### FD-7. Edit a post (delete + repost flow)

**Role:** member (author)  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member who has at least one community post visible in the Commons.

**Steps:**
1. Find your own post in the Commons.
2. Click/tap the **Edit** button next to it.
3. Confirm the post's text is loaded into the composer.
4. Confirm the original post is removed from the timeline.
5. Modify the text slightly and send.
6. Confirm the new post appears in the Commons with the updated text and a new timestamp.
7. Confirm there is no inherited reaction count or reply thread on the new post.

**Expected:** Edit loads the old text, removes the old post, and a fresh send creates a new post. The new post has no reactions or replies from the deleted post.

**Result:** web ☐

---

### FD-8. Delete your own post

**Role:** member (author)  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member who has at least one community post.

**Steps:**
1. Find your own community post.
2. Click/tap **Delete**.
3. Confirm the post disappears from the timeline.
4. Reload.
5. Confirm the post is not visible to you or to another member account (if you can switch).

**Expected:** Post is gone after delete and does not reappear. Any replies that were under the post are also gone.

**Result:** web ☐

---

### FD-9. Cannot delete another member's post

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as member A. Member B has a community post visible.

**Steps:**
1. Find a community post authored by someone else.
2. Confirm there is no Delete or Edit button on that post for you.
3. If you can craft a direct API call, attempt `DELETE /api/commons/messages/<their-postId>` with your credentials.

**Expected:** No delete affordance appears on another member's post. A direct API call returns 403.

**Result:** web ☐

---

### FD-10. Reply to a community post

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member. At least one community post exists.

**Steps:**
1. Find a community post in the Commons.
2. Use the reply control to reply to it.
3. Type a short reply body and submit.
4. Confirm the reply appears threaded under or near the original post.

**Expected:** Reply is created, appears in the thread, and is attributed to your member handle. No error.

**Result:** web ☐

---

### FD-11. Emoji reaction — add, verify, toggle off

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member. At least one community post by another member exists (you cannot react to your own post).

**Steps:**
1. Find a community post authored by someone else.
2. Open the reaction picker.
3. Confirm the available emojis are exactly: 👍 ❤️ 😂 🎉 🙏 😢 👋 (seven total).
4. Click 👍.
5. Confirm the reaction count on that post increases by 1 and the 👍 appears highlighted/selected ("reacted by me").
6. Click 👍 again.
7. Confirm the reaction is removed (count decreases, highlight gone).

**Expected:** Reaction adds on first click, removes on second click (toggle). Emoji outside the set of seven is not offered.

**Result:** web ☐

---

### FD-12. Reaction on announcement

**Role:** member  
**Surfaces:** web  
**Precondition:** At least one published announcement is in the Commons.

**Steps:**
1. Find a published announcement card.
2. Open the reaction picker on it.
3. Add ❤️.
4. Confirm the reaction appears.
5. Toggle it off.

**Expected:** Reactions work on announcements the same as on community posts, using the same fixed emoji set.

**Result:** web ☐

---

### FD-13. Reply to an announcement

**Role:** member  
**Surfaces:** web  
**Precondition:** A published announcement exists.

**Steps:**
1. Find a published announcement in the Commons.
2. Use the reply control to reply to it.
3. Submit a short reply.
4. Confirm the reply appears threaded under the announcement.
5. Confirm the reply is attributed to your handle.

**Expected:** Reply posts successfully and threads under the announcement. No error.

**Result:** web ☐

---

### FD-14. Edit your own announcement reply

**Role:** member (author of an announcement reply)  
**Surfaces:** web  
**Precondition:** You have an existing reply on an announcement.

**Steps:**
1. Find your reply on an announcement.
2. Click **Edit** on your reply.
3. Change the text.
4. Save.
5. Confirm the reply shows the updated text and an "edited" mark.

**Expected:** Edit saves the new text, marks the reply as edited, and does not change the author attribution.

**Result:** web ☐

---

### FD-15. Delete your own announcement reply

**Role:** member (author of an announcement reply)  
**Surfaces:** web  
**Precondition:** You have an existing reply on an announcement.

**Steps:**
1. Find your reply.
2. Click **Delete**.
3. Confirm the reply is removed from the thread.

**Expected:** Reply disappears. This is a hard delete (your own words, your own decision). The announcement itself remains.

**Result:** web ☐

---

### FD-16. Submit a Q&A question

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member.

**Steps:**
1. Find the question submission UI (a compose or ask field in the Questions channel).
2. Type a natural-language question, e.g. "Find me housing near 90210."
3. Optionally select a category (housing, services, general, safety, benefits).
4. Submit.
5. Confirm the question appears in the Questions feed.

**Expected:** Question is created and visible. If an LLM answer is generated, it appears inline with a confidence score and source attribution. No error.

**Result:** web ☐

---

### FD-17. Rate an answer — helpful / not helpful / flagged

**Role:** member  
**Surfaces:** web  
**Precondition:** At least one Q&A answer exists in the seeded data.

**Steps:**
1. Find an answer in the Questions feed.
2. Click/tap **Helpful**.
3. Confirm the rating is recorded (button state changes or count updates).
4. Find another answer and click **Flagged**.
5. Confirm the flag is recorded.

**Expected:** All three rating options are available. Ratings submit without error. A flagged answer registers a flag count visible to admins (verified in FD-A6).

**Result:** web ☐

---

### FD-18. Quoted reply (Signal-style) and tap-to-jump

**Role:** member  
**Surfaces:** web  
**Precondition:** At least one community post exists.

**Steps:**
1. In the Commons, use the reply/quote control on a community post to create a quoted reply.
2. Confirm the reply shows a snippet of the quoted post above the reply body.
3. Click/tap the quoted snippet.
4. Confirm the view scrolls to or highlights the original post (if it is in the loaded window).

**Expected:** Quote snippet appears in the reply. Tapping it jumps to the original. If the original is outside the loaded window, the tap is a no-op (the snippet still shows the text — this is acceptable and not a bug).

**Result:** web ☐

---

### FD-19. Paragraph breaks are preserved

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a seeded member.

**Steps:**
1. In the Commons composer, type a message with two clear paragraphs separated by pressing Enter twice.
2. Submit.
3. Confirm the message renders with the paragraph break intact — not as one run-on line.

**Expected:** Multi-paragraph post renders with visible line breaks. The `white-space: pre-wrap` rule applies so content does not collapse.

**Result:** web ☐

---

### FD-20. Signed-out public read of community posts

**Role:** unauthenticated visitor  
**Surfaces:** web  
**Precondition:** `feed_render_config.is_public` is TRUE (the default). At least one community post exists.

**Steps:**
1. Sign out completely.
2. Navigate to the home page.
3. Confirm community posts are visible without signing in.
4. Confirm no per-user state is shown (no read indicators, no dismissals, no author user IDs).
5. Confirm announcements and AI answers are NOT shown in the signed-out view (community posts only).
6. Confirm there is no compose/post input for a signed-out visitor.

**Expected:** Signed-out visitor sees community posts only (not announcements or Q&A answers), with no author IDs, no per-user state, and no ability to post.

**Result:** web ☐

---

### FD-21. Member handle display — named vs unnamed

**Role:** member  
**Surfaces:** web  
**Precondition:** One seeded member has a username set; another does not.

**Steps:**
1. Sign in as a member with a username.
2. Post a community message.
3. Confirm the post is attributed to your username.
4. Sign in as a member without a username.
5. Post a community message.
6. Confirm the post is attributed to a stable pseudonym (format `user-<first 8 of user id>`), not to the generic "Community member" label.
7. Confirm the Commons shows a nudge prompting the unnamed member to set a username.

**Expected:** Named member → username shown. Unnamed member → stable `user-XXXXXXXX` handle shown. No two unnamed members collapse to the same label.

**Result:** web ☐

---

### FD-22. Blocked member's posts do not appear

**Role:** member  
**Surfaces:** web  
**Precondition:** Member A has blocked Member B (or B has blocked A). Member B has community posts in the Commons.

**Steps:**
1. Sign in as Member A.
2. Navigate to the Commons.
3. Confirm Member B's community posts and replies are not visible.
4. Confirm announcements and AI Q&A items still appear normally.

**Expected:** Blocked member's posts and replies are hidden. Announcements and AI items (which have no member author) are unaffected.

**Result:** web ☐

---

### FD-23. "New messages" divider appears after being away

**Role:** member  
**Surfaces:** web  
**Precondition:** Member has previously visited the Commons. New posts have been added since their last visit (use the seed data or post as a second account).

**Steps:**
1. Sign in as a member who has been away.
2. Navigate to the Commons.
3. Confirm a "New messages" divider appears somewhere in the message list, separating older messages from ones posted since the last visit.

**Expected:** A single divider appears at the right position. If no new messages exist, no divider appears. A read/write error on the `feed_commons_last_seen` table must not break the chat (best-effort).

**Result:** web ☐

---

## Admin walkthrough

### FD-A1. Admin surface header and landing tile name

**Role:** admin  
**Surfaces:** web  
**Precondition:** Signed in as admin.

**Steps:**
1. Navigate to the `/admin` landing page.
2. Find the tile for this service.
3. Confirm the tile is named **Commons: Feed & Announcements**.
4. Click it and confirm the page header reads **Commons: Feed & Announcements Admin**.
5. Confirm a separate tile named **Commons Moderation** also exists on the landing page.

**Expected:** Tile name matches "Commons: Feed & Announcements" exactly. Page header matches "Commons: Feed & Announcements Admin" exactly. Two distinct Commons admin tiles are present.

**Result:** web ☐

---

### FD-A2. Create, edit, and publish an announcement draft

**Role:** admin  
**Surfaces:** web  
**Precondition:** Signed in as admin. On `/admin/feed-announcements`.

**Steps:**
1. Click **New announcement** (or equivalent create action).
2. Enter a title and body text. Include two paragraphs in the body.
3. Save as draft.
4. Confirm the draft appears in the announcement list with status "draft."
5. Click **Edit** on the draft.
6. Change the title text.
7. Click **Save changes**.
8. Confirm the list now shows the updated title, still in "draft" status.
9. Click **Publish** on the draft.
10. Confirm the status changes to "published."
11. Navigate to the Commons as a member (or open a second session) and confirm the announcement appears in the Commons feed.

**Expected:** Draft create, edit, and publish all succeed. Published announcement appears in the Commons. Paragraph breaks in the body are preserved. The Edit button appears on drafts only — a published announcement does not show an Edit button.

**Result:** web ☐

---

### FD-A3. Archive a published announcement

**Role:** admin  
**Surfaces:** web  
**Precondition:** At least one published announcement exists.

**Steps:**
1. On `/admin/feed-announcements`, find a published announcement.
2. Click **Archive**.
3. Confirm the status changes to "archived."
4. Check the Commons as a member and confirm the archived announcement is no longer visible.

**Expected:** Archive succeeds. Announcement disappears from the member-facing Commons.

**Result:** web ☐

---

### FD-A4. Attach a plugin link to an announcement

**Role:** admin  
**Surfaces:** web  
**Precondition:** At least one non-admin-only plugin exists in the registry.

**Steps:**
1. Create a new announcement draft.
2. In the "Link a plugin" picker, select a visible plugin (e.g. Chyme or Skills Economy).
3. Save and publish.
4. In the Commons as a member, find the announcement.
5. Confirm the announcement body contains a line reading **Open \<Plugin Name\>: https://app.chargingthefuture.com/apps/\<slug\>**.

**Expected:** The link-out line appears exactly once in the announcement body. Publishing again does not add a duplicate line.

**Result:** web ☐

---

### FD-A5. Update global feed render config

**Role:** admin  
**Surfaces:** web  
**Precondition:** Signed in as admin. On `/admin/feed-announcements`.

**Steps:**
1. Find the feed configuration panel.
2. Change the render mode (e.g. from "card" to "card+toast" if both are offered).
3. Save.
4. Confirm the saved value is reflected back in the panel on reload.

**Expected:** Config update persists. No error on save.

**Result:** web ☐

---

### FD-A6. Flagged answers queue

**Role:** admin  
**Surfaces:** web  
**Precondition:** At least one Q&A answer has been flagged by a member (do step FD-17 first, or use seeded flagged answers).

**Steps:**
1. Navigate to `/admin/commons` or the Commons Moderation admin surface.
2. Find the **Flagged answers** tab.
3. Confirm flagged answers appear, ordered most-flagged first.
4. Confirm each row shows the parent question, the answer text, whether it is from the AI assistant or a member, and its flag/not-helpful counts.
5. Confirm the tab label shows the count of pending (still-visible) flagged answers.

**Expected:** Flagged answers are visible and ordered by flag count. The pending count is on the tab label. Hiding an answer removes it from the member-facing Q&A but leaves the parent question up so the member can get another answer.

**Result:** web ☐

---

### FD-A7. Relabel a question category

**Role:** admin  
**Surfaces:** web  
**Precondition:** At least one question exists with a category (seeded).

**Steps:**
1. On the admin Q&A management surface, find a question.
2. Change its category to a different valid value (e.g. from "housing" to "general").
3. Save.
4. Confirm the new category is displayed.
5. Attempt to save with an invalid category string (if the UI allows free entry). Expect a 400.

**Expected:** Valid relabel saves and displays. Invalid category is rejected. An audit entry is written (not user-visible, but the action should not fail silently).

**Result:** web ☐

---

### FD-A8. Commons moderation — hide and restore a post

**Role:** admin  
**Surfaces:** web  
**Precondition:** At least one community post exists from a member.

**Steps:**
1. Navigate to `/admin/commons` → **Commons Moderation**.
2. Find a member community post in the queue.
3. Select a moderation reason from the picker (e.g. "Off topic").
4. Click **Hide**.
5. Confirm the post shows as hidden in the moderation queue and the hidden count increases.
6. Open the Commons as a member (second session or different account) and confirm the post is no longer visible.
7. Back in admin, find the hidden post.
8. Click **Put back** (or restore).
9. Confirm a confirmation step is required before restoring.
10. Confirm the post is restored (moderation status cleared, reason/actor/timestamp cleared).
11. Check the Commons as a member — the post should be visible again.

**Expected:** Hide removes the post from member view. Restore requires a deliberate confirmation and puts it back. After restore, no stored reason or actor remains on the row. Hiding does not require confirmation; restoring does.

**Result:** web ☐

---

### FD-A9. Moderating by member (author filter)

**Role:** admin  
**Surfaces:** web  
**Precondition:** At least one member has multiple community posts.

**Steps:**
1. On `/admin/commons`, find the **By member** tab or author roster.
2. Confirm the roster lists aggregate counts per member, ordered by volume — no post bodies are shown in the roster view.
3. Click a member in the roster.
4. Confirm you now see that member's full Commons footprint (posts and replies).
5. Confirm the roster itself is no longer shown once you have selected a member.

**Expected:** Roster shows aggregates only (no bodies). Selecting a member switches to their footprint view. The roster disappears once a member is selected (it was used to pick someone; it is not needed after that).

**Result:** web ☐

---

### FD-A10. Hide a Q&A answer from the moderation surface

**Role:** admin  
**Surfaces:** web  
**Precondition:** At least one Q&A answer is visible in the flagged answers tab or moderation queue.

**Steps:**
1. In the flagged answers queue, find a visible answer.
2. Set `hidden: true` (hide it).
3. Confirm the answer is no longer visible to a member on the Q&A channel.
4. Confirm the parent question is still visible.
5. Restore the answer and confirm it reappears.

**Expected:** Hiding an answer suppresses it without deleting the question. Restore brings it back. No admin can edit the answer's text — hide and restore only.

**Result:** web ☐

---

### FD-A11. Moderate a reply on an announcement

**Role:** admin  
**Surfaces:** web  
**Precondition:** At least one member reply exists on a published announcement.

**Steps:**
1. On `/admin/commons`, find a reply listed under the announcement thread (labeled "Announcement reply").
2. Confirm the row links to its parent announcement.
3. Hide the reply.
4. Check the Commons — the reply is gone from the announcement thread.
5. Restore it from admin.

**Expected:** Announcement replies appear in the moderation queue labeled "Announcement reply." Hide and restore work the same as for community posts.

**Result:** web ☐

---

### FD-A12. Membership event emit

**Role:** admin  
**Surfaces:** web  
**Precondition:** Signed in as admin.

**Steps:**
1. From the admin surface or via a direct API call, emit a membership event: `POST /api/feed/membership/events` with body `{ "userId": "<a seeded member id>", "pluginId": "feed", "eventType": "join" }` and the `x-ctf-csrf: '1'` header.
2. Confirm the response is `{ ok: true, streamEmitted: <boolean> }`.
3. Emit the same event again to confirm idempotency does not crash (a duplicate is fine even though the command is not idempotent by contract).
4. Attempt the same call without the CSRF header and confirm it is rejected.

**Expected:** Valid call returns `{ ok: true }`. Missing CSRF header returns a 4xx. An audit entry is written on both success and failure (not directly verifiable from the UI, but the call must not fail silently).

**Result:** web ☐

---

### FD-A13. Admin community post — higher character cap

**Role:** admin  
**Surfaces:** web  
**Precondition:** Signed in as admin.

**Steps:**
1. In the Commons composer (as admin), type a message that is between 1,201 and 4,000 characters.
2. Confirm the send button is **not** disabled (the 1,200-character member cap does not apply).
3. Submit the post.
4. Confirm it appears in the Commons.
5. Type a message over 4,000 characters.
6. Confirm the send button is disabled and the counter shows how many characters to remove.

**Expected:** Admin can post up to 4,000 characters. Over 4,000 is blocked. The raw-HTML block still applies to admins.

**Result:** web ☐

---

## Parity check (web ↔ android)

Android was removed on 2026-07-20 (rule 105, PR #1742). The Commons is web-only. There are no Android surfaces to compare against.

If a future session adds Android support, the following cases would need parity checks:
- FD-5 (community post creation)
- FD-10 (threaded reply)
- FD-16 (Q&A question submit)
- FD-17 (answer rating)
- FD-2 (mark read)
- FD-3 (dismiss announcement)

Until then, all result lines carry only `web ☐`.

---

## Known gaps — do not file these as bugs

1. **LLM provider failover** — the Q&A inference runs against a single configured provider. If the provider is down, answers will not generate. Provider failover and confidence-thresholding policy are not yet contractualized. Do not file a bug if the LLM is unavailable during testing.

2. **Deprecated ANNOUNCEMENTS_PLUGIN contracts** — separate `ANNOUNCEMENTS_PLUGIN_*_CONTRACTS.yaml` files still exist in the repo. Their presence is intentional historical reference and is a known cleanup item, not a defect.

3. **`GET /api/feed/admin/questions` orphaned route** — this route exists and is documented in `orphan-route-allowlist.json` as a burn-down entry. Its `flagged_count` field is superseded by the flagged-answers queue (FD-A6). The route having no caller in the UI is a known debt item, not a bug to file.

4. **Tap-to-jump for quoted replies on older messages** — if the quoted post is outside the currently loaded window, the tap is a no-op (the snippet still shows the text). This is accepted behavior, not a bug.

5. **Posts saved before the paragraph-break fix (2026-07-16)** — messages stored before that fix were already flattened in storage and will render as single paragraphs regardless of how the screen applies `white-space: pre-wrap`. Re-posting is the only way to recover the formatting. Do not file a bug for old seeded content that looks flat.

6. **`feed_timeline_projection` table** — defined in schema but has no runtime reader or writer. It is a reserved slot for a future materialized timeline read model. Its emptiness is not a defect.
