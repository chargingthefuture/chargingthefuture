# Commons (Feed & Announcements) — Manual Test Script
> Generated from the feature inventory and command/access/audit contracts for the `feed` plugin; this is the runnable checklist for a real-device session. To regenerate: `pnpm --dir ctf test-script:generate -- feed`

| Field | Value |
|---|---|
| **Plugin** | Commons (Feed & Announcements) |
| **Visibility** | Member |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop + mobile-responsive browser); Android surface was removed 2026-07-20 — web only |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-feed-feature-inventory.md` |
| **Generated** | 2026-07-25 (commit 95cb98b2) |

---

## How to run this

- Mark each result ✅ pass / ❌ fail / ⛔ blocked.
- A ❌ becomes a row in the Bug Reporting plugin — record case ID, surface, steps to reproduce, and actual result.
- Run **Core smoke** at the start of every session before any other cases.
- "Web" means a desktop or mobile-responsive browser; there is no Android surface for this plugin.

---

## Core smoke (every session)

1. **Seed is clean.** Run `pnpm --dir ctf seed:demo`. Confirm the command exits without errors and the app starts. web ☐

2. **Commons home loads.** Sign in as a member. Navigate to the Survivor Hub home. The feed timeline renders with at least one item (announcement, question, or community post) and no unhandled error is shown. web ☐

3. **Admin page loads.** Sign in as an admin. Navigate to `/admin/feed-announcements`. The page renders with a feed config panel and an announcement list. No 404 or 500. web ☐

4. **`/apps/feed-announcements` is gone.** With any authenticated session navigate to `/apps/feed-announcements`. Expect a 404 — the member-facing app shell was removed. web ☐

5. **Public community route works unauthenticated.** Sign out completely. `GET /api/feed/public/community` returns `{ isPublic: true, posts: [...] }` (or `isPublic: false` if the community channel is disabled in config). No authentication error. web ☐

---

## Member walkthrough

### FD-1 — Timeline loads across all channels
**Role:** member | **Surface:** web

**Precondition:** Signed in as a member. Seed has run (`pnpm --dir ctf seed:demo`).

**Steps:**
1. Navigate to the Survivor Hub home (the Commons).
2. Observe the default feed — all channels.
3. Use the channel filter to switch to **Announcements**.
4. Switch to **Questions**.
5. Switch to **Community**.
6. Switch back to **All**.

**Expected:**
- Default view shows items from multiple channel types (announcement cards, question cards, community posts) in reverse-chronological order.
- Each filter shows only items of that type; no items from other channels appear.
- Switching back to All restores the blended view.
- No loading spinner stays permanently; empty state message shows if a channel has no items.

**Result:** web ☐

---

### FD-2 — Announcement card renders correctly
**Role:** member | **Surface:** web

**Precondition:** At least one published announcement exists (seed provides this).

**Steps:**
1. In the Announcements channel (or All), locate an announcement card.
2. Confirm the card uses the accent color `#84CC16` and Lucide icons (Megaphone or equivalent), not emoji icons.
3. Confirm there is no "GetStream ⚡" badge anywhere on the card.
4. If the announcement has a linked plugin slug, confirm the card body contains an "Open \<Plugin\>:" link pointing to `https://app.chargingthefuture.com/apps/<slug>`.

**Expected:**
- Card matches the design spec: `#84CC16` accent, Lucide icons, no badge.
- Linked-plugin line is present when a plugin is attached; absent when no plugin is linked.

**Result:** web ☐

---

### FD-3 — Mark a feed item read
**Role:** member | **Surface:** web

**Precondition:** At least one unread feed item exists.

**Steps:**
1. Open the Commons and find an unread feed item (visual indicator or default state).
2. Interact with it in a way that triggers read-marking (open, click, or scroll to it — whatever the UI exposes).
3. Reload the page.

**Expected:**
- After reload the item no longer shows as unread.
- No error is thrown; the action is idempotent (triggering it again on the same item does not error).

**Result:** web ☐

---

### FD-4 — Dismiss an announcement
**Role:** member | **Surface:** web

**Precondition:** At least one published announcement is visible and not yet dismissed.

**Steps:**
1. Find a published announcement in the feed.
2. Use the dismiss control on the card (X button or equivalent).
3. Confirm the card disappears from the feed.
4. Reload the page.

**Expected:**
- The announcement is removed from the timeline immediately.
- After reload it remains hidden (dismissal is persisted per user).
- Every announcement has a dismiss control — there is no mandatory/non-dismissable announcement.

**Result:** web ☐

---

### FD-5 — Submit a question (LLM Q&A channel)
**Role:** member | **Surface:** web

**Precondition:** Signed in as a member.

**Steps:**
1. Find the question submission form in the Questions channel or Commons.
2. Type a natural-language question, e.g., "Find housing within 10 miles of 90210".
3. Optionally select a category (housing, services, general, safety, or benefits).
4. Submit the question.

**Expected:**
- The question appears in the Questions channel feed as a new item.
- An LLM-generated answer card appears below or inline, showing a body, confidence score, and source attribution (model ID visible or shown on demand).
- No raw error is shown to the user.

**Result:** web ☐

---

### FD-6 — Rate an LLM answer
**Role:** member | **Surface:** web

**Precondition:** At least one question with an LLM-generated answer is visible (from seed or FD-5).

**Steps:**
1. Locate a question card with an LLM-generated answer.
2. Click the "Helpful" rating option.
3. Click the "Not Helpful" option on a different answer (or toggle it on the same one).
4. Click "Flag" on a third answer if available.

**Expected:**
- Each rating registers without error.
- The UI reflects the selected rating (button state, count, or confirmation).
- Rating the same answer a second time does not duplicate or error — idempotent per user per answer.

**Result:** web ☐

---

### FD-7 — Create a community post
**Role:** member | **Surface:** web

**Precondition:** Signed in as a member.

**Steps:**
1. Open the Commons community channel or the Hub home.
2. Type a community post in the composer (fewer than 1,200 characters, no HTML tags, no more than 3 links).
3. Submit the post.
4. Confirm the post appears immediately in the feed under the author's handle (`@username` or `user-<first 8 of user id>` if no username is set).
5. Now try to submit a post that is exactly 1,201 characters long.

**Expected:**
- The valid post appears in the feed attributed to the correct member handle.
- The 1,201-character post is rejected with a validation error before it reaches the server (or returns a 400); it does not silently post.

**Result:** web ☐

---

### FD-8 — Member post with raw HTML is blocked
**Role:** member | **Surface:** web

**Precondition:** Signed in as a member.

**Steps:**
1. In the community composer, type a message containing `<b>bold</b>`.
2. Submit.

**Expected:**
- The post is rejected. The UI shows a moderation or validation error. No HTML is stored or rendered.

**Result:** web ☐

---

### FD-9 — Community post preserves paragraph breaks
**Role:** member | **Surface:** web

**Precondition:** Signed in as a member.

**Steps:**
1. In the community composer, type a two-paragraph message with a blank line between paragraphs, e.g.:
   ```
   First paragraph.

   Second paragraph.
   ```
2. Submit the post.
3. Observe the post as rendered in the feed.

**Expected:**
- The rendered post shows two distinct paragraphs with visible spacing or line breaks between them — it does not collapse into one run-on line.

**Result:** web ☐

---

### FD-10 — Reply to a community post
**Role:** member | **Surface:** web

**Precondition:** At least one community post exists.

**Steps:**
1. Find a community post in the Commons.
2. Use the reply control to post a threaded reply.
3. Confirm the reply appears inline under the original post.

**Expected:**
- Reply is stored and shown under the correct parent post.
- The reply is attributed to the replying member.
- No error is thrown.

**Result:** web ☐

---

### FD-11 — Signal-style quoted reply
**Role:** member | **Surface:** web

**Precondition:** At least one community post exists. The UI exposes a "Quote reply" or similar action.

**Steps:**
1. In the Commons chat, select the quote/reply action on an existing community post.
2. Type a response in the composer and submit.
3. Observe the new post in the feed.

**Expected:**
- The new post shows a quoted snippet of the original post (author handle + ~120-char preview) above the reply body.
- Tapping the quoted snippet scrolls to the original post and briefly highlights it. If the original is outside the loaded window, the tap is a no-op but the snippet still shows.

**Result:** web ☐

---

### FD-12 — Delete your own community post
**Role:** member | **Surface:** web

**Precondition:** Signed in as a member with at least one of their own community posts visible.

**Steps:**
1. Find one of your own posts in the Commons.
2. Use the Delete control.
3. Confirm the post disappears from the feed.
4. Reload the page.

**Expected:**
- The post and its replies and reactions are removed from the feed.
- After reload the post is gone.
- Attempting to delete another member's post shows a 403 error or no delete option is presented.

**Result:** web ☐

---

### FD-13 — Edit a community post (delete + repost)
**Role:** member | **Surface:** web

**Precondition:** Signed in as a member with at least one of their own community posts visible.

**Steps:**
1. Find one of your own posts in the Commons.
2. Click the **Edit** button next to Delete.
3. Confirm the post's text is loaded back into the composer.
4. Confirm the original post is deleted (disappears from the feed).
5. Modify the text and submit.

**Expected:**
- The original post is removed immediately when Edit is clicked.
- The composer is pre-filled with the original text.
- Submitting creates a new post (new timestamp, no inherited reactions or replies).
- Any active quote/reply target is cleared when Edit is activated.

**Result:** web ☐

---

### FD-14 — React to a community post
**Role:** member | **Surface:** web

**Precondition:** At least one community post exists that was not created by the signed-in member.

**Steps:**
1. Find a community post by another member.
2. Open the reaction picker.
3. Confirm the picker shows exactly these emojis: 👍 ❤️ 😂 🎉 🙏 😢 👋 (seven total, in that order).
4. Tap 👍 to react.
5. Confirm the 👍 chip appears with a count of 1 and is highlighted.
6. Tap 👍 again to toggle it off.
7. Confirm the chip count returns to 0 (or the chip is removed).
8. Try to submit an emoji not in the set (e.g., 🚀) via the API directly (`POST /api/hub/messages/:postId/reactions` with `{ emoji: "🚀" }`).

**Expected:**
- Picker shows exactly 7 emojis in the specified order.
- First tap adds the reaction; second tap removes it.
- The out-of-set emoji request returns 400.

**Result:** web ☐

---

### FD-15 — Cannot react to your own post
**Role:** member | **Surface:** web

**Precondition:** Signed in as a member with at least one of their own community posts visible.

**Steps:**
1. Find one of your own community posts.
2. Attempt to react to it (open picker and tap an emoji, or call `POST /api/hub/messages/:postId/reactions`).

**Expected:**
- The reaction is rejected. The UI does not show the picker on your own post, or the server returns an error (400/403) if called directly.

**Result:** web ☐

---

### FD-16 — Unread "New messages" divider
**Role:** member | **Surface:** web

**Precondition:** The seeded data includes community posts. Sign out and sign back in, or open the Commons from a fresh session.

**Steps:**
1. Open the Commons hub home chat.
2. Observe whether a "New messages" divider appears above posts that arrived since the last visit.
3. Scroll past the divider.
4. Close and reopen the Commons.

**Expected:**
- A single "New messages" divider appears before the first post newer than the last-seen marker.
- After viewing, the divider does not reappear on the next open (the marker has advanced).
- If the divider fails to render, the chat still loads and functions normally (best-effort).

**Result:** web ☐

---

### FD-17 — Public community view (signed out)
**Role:** unauthenticated | **Surface:** web

**Precondition:** Signed out completely.

**Steps:**
1. Navigate to the Survivor Hub home (or call `GET /api/feed/public/community`).
2. Observe what is shown.
3. Send more than 30 requests to `GET /api/feed/public/community` within one minute from the same IP.

**Expected:**
- Community posts are visible without signing in (`isPublic: true` and a `posts` array).
- **No** announcements, AI answers, replies, per-user state, or author user IDs appear in the response.
- Authors are anonymized as "Community member" (no real handle or user ID).
- After 30 requests per minute the route returns 429 with a `Retry-After` header.

**Result:** web ☐

---

### FD-18 — Signed-in member handle attribution
**Role:** member | **Surface:** web

**Precondition:** Two member accounts: one with a username set, one without.

**Steps:**
1. Sign in as the member **without** a username.
2. Post a community message.
3. Observe the author label on the post.
4. Sign in as the member **with** a username.
5. Post a community message.
6. Observe the author label on the post.

**Expected:**
- The member without a username is shown as `user-<first 8 chars of their user ID>`, not "Community member".
- The member with a username is shown as `@<username>`.
- A nudge to set a username appears in the Commons for the member without one.

**Result:** web ☐

---

## Admin walkthrough

### FD-A1 — Admin page renders with real data
**Role:** admin | **Surface:** web

**Precondition:** Signed in as an admin. Seed has run.

**Steps:**
1. Navigate to `/admin/feed-announcements`.
2. Observe the header (should include an icon + ADMIN badge).
3. Confirm the feed config panel shows current values from the database (render mode, enabled channels, `is_public` flag).
4. Confirm an announcement list is shown.

**Expected:**
- Page loads with no placeholder or mock data.
- Config values reflect what the seed inserted.
- Announcement list is populated.

**Result:** web ☐

---

### FD-A2 — Create an announcement draft
**Role:** admin | **Surface:** web

**Precondition:** Signed in as an admin on `/admin/feed-announcements`.

**Steps:**
1. Fill in the "New announcement" form with a title and body.
2. Optionally select a linked plugin from the picker.
3. Submit (POST).
4. Confirm the new draft appears in the announcement list with status **draft**.

**Expected:**
- Draft is created and listed with status `draft`.
- If a linked plugin was selected, it is shown in the list row.
- No 503 or CSRF error.
- The form does **not** reset on a failed submit — it retains the typed content.

**Result:** web ☐

---

### FD-A3 — Edit a draft announcement
**Role:** admin | **Surface:** web

**Precondition:** At least one draft announcement exists (from FD-A2 or seed).

**Steps:**
1. On `/admin/feed-announcements`, find a draft row.
2. Click the **Edit** action.
3. Confirm the form switches to "Edit announcement" with a "Save changes" button and a "Cancel" button, pre-filled with the draft's title and body.
4. Change the title text.
5. Click "Save changes".
6. Confirm the draft row updates with the new title.
7. Click Edit again and then Cancel — confirm edit mode is cleared.

**Expected:**
- Edit is offered on draft rows only (not published or archived).
- Save calls PUT and the list reflects the update.
- Cancel returns to the normal create form without saving.

**Result:** web ☐

---

### FD-A4 — Publish a draft announcement
**Role:** admin | **Surface:** web

**Precondition:** At least one draft announcement exists.

**Steps:**
1. Find a draft in the announcement list.
2. Click Publish.
3. Confirm the announcement status changes to **published** in the list.
4. As a member (open a second browser window or incognito), navigate to the Commons and check the Announcements channel.

**Expected:**
- Status in admin list changes to `published`.
- The announcement appears in the member-visible Announcements channel (not silently excluded).
- If a linked plugin slug was set, the announcement body in the member feed contains "Open \<Plugin\>: https://app.chargingthefuture.com/apps/\<slug\>".

**Result:** web ☐

---

### FD-A5 — Archive a published announcement
**Role:** admin | **Surface:** web

**Precondition:** At least one published announcement exists.

**Steps:**
1. Find a published announcement in the admin list.
2. Click Archive.
3. Confirm the status changes to **archived** in the list.
4. As a member, refresh the Commons — confirm the archived announcement is no longer visible.

**Expected:**
- Status changes to `archived`.
- Archived announcement disappears from the member feed.

**Result:** web ☐

---

### FD-A6 — Admin cannot edit a non-draft announcement
**Role:** admin | **Surface:** web

**Precondition:** At least one published or archived announcement exists.

**Steps:**
1. Find a published or archived row in the admin announcement list.
2. Confirm there is no **Edit** action on that row (only draft rows show Edit).

**Expected:**
- No Edit button appears on published or archived rows. If the `PUT /api/feed/admin/announcements/:id` endpoint is called directly on a non-draft ID it returns an error (the `draftStateGuard` contract rejects it).

**Result:** web ☐

---

### FD-A7 — Update feed render config
**Role:** admin | **Surface:** web

**Precondition:** Signed in as an admin on `/admin/feed-announcements`.

**Steps:**
1. In the feed config panel, change the render mode (e.g., toggle between card-only and card+toast if the UI exposes both).
2. Save the change.
3. Reload the admin page.

**Expected:**
- The new render mode is reflected after reload (persisted to `feed_render_config`).
- No CSRF error.

**Result:** web ☐

---

### FD-A8 — Disable a channel via config
**Role:** admin | **Surface:** web

**Precondition:** Signed in as an admin. At least one channel is enabled.

**Steps:**
1. In the admin config panel, disable the **Community** channel.
2. Save.
3. As a member, open the Commons and switch to the Community channel filter.

**Expected:**
- The Community channel is empty or not accessible to the member while disabled.
- Re-enabling the channel and saving restores community posts to the feed.

**Result:** web ☐

---

### FD-A9 — Admin community post uses higher character cap
**Role:** admin | **Surface:** web

**Precondition:** Signed in as an admin.

**Steps:**
1. In the Commons composer (or via `POST /api/hub/messages`), compose a community post of 2,000 characters (well above the 1,200-character member cap).
2. Submit.

**Expected:**
- The post is accepted and appears in the feed (admin cap is 4,000 characters).
- The same 2,000-character body submitted by a **member** session would be rejected with a validation error.

**Result:** web ☐

---

### FD-A10 — Admin relabels a question category
**Role:** admin | **Surface:** web

**Precondition:** At least one question exists (from seed or FD-5).

**Steps:**
1. Call `PATCH /api/feed/admin/questions/:questionId` with body `{ "category": "safety" }` and the `x-ctf-csrf: '1'` header, using a valid question ID from the seed.
2. Confirm the response is 200.
3. Try the same with `{ "category": "unknown_category" }`.
4. Try with a non-UUID question ID.

**Expected:**
- Valid relabel returns 200 and writes a `feed.question.category.relabel` audit row.
- Invalid category returns 400.
- Non-UUID ID returns 400.
- Unknown but valid-format UUID returns 404.

**Result:** web ☐

---

### FD-A11 — Membership event emit
**Role:** admin | **Surface:** web

**Precondition:** Signed in as an admin.

**Steps:**
1. Call `POST /api/feed/membership/events` with `{ "userId": "<a valid userId>", "pluginId": "feed", "eventType": "join" }` and `x-ctf-csrf: '1'`.
2. Confirm the response contains `{ ok: true, streamEmitted: <boolean> }`.
3. Repeat with `eventType: "leave"`.
4. Try omitting `userId` — expect 400.
5. Try without admin credentials — expect 403.

**Expected:**
- Valid payloads return `ok: true`.
- Missing required fields return 400.
- Non-admin caller is rejected with 403.

**Result:** web ☐

---

### FD-A12 — Member cannot reach admin routes
**Role:** member | **Surface:** web

**Precondition:** Signed in as a non-admin member.

**Steps:**
1. `GET /api/feed/admin/config` — note the response code.
2. `POST /api/feed/admin/announcements` with a valid body — note the response code.
3. Navigate to `/admin/feed-announcements` in the browser.

**Expected:**
- All three return 401 or 403 (no data is returned).
- The admin page redirects or shows an access-denied state.

**Result:** web ☐

---

### FD-A13 — CSRF protection on state-changing routes
**Role:** admin | **Surface:** web

**Precondition:** Signed in as an admin.

**Steps:**
1. Call `POST /api/feed/admin/announcements/:id/publish` **without** the `x-ctf-csrf: '1'` header.
2. Call `POST /api/feed/items/:itemId/dismiss` **without** the `x-ctf-csrf: '1'` header.

**Expected:**
- Both requests are rejected (400 or 403). No state is changed.

**Result:** web ☐

---

## Parity check (web ↔ android)

Android was removed 2026-07-20 (PR #1742, rule 105). All cases are web-only. No cross-surface parity checks apply.

The following cases are the highest-signal functional checks that must remain consistent across **desktop browser** and **mobile-responsive browser** (both are "web" surfaces):

| Case | Behavior that must match on both viewport sizes |
|---|---|
| FD-2 | Announcement card renders with correct accent color and icons |
| FD-7 | Community post composer enforces 1,200-char / 3-link limit |
| FD-9 | Paragraph breaks preserved in rendered posts |
| FD-14 | Reaction picker shows all 7 emojis and toggles correctly |
| FD-A4 | Published announcement appears in member feed |

---

## Known gaps — do not file these as bugs

1. **LLM provider failover not contractualized.** The Q&A pipeline runs against a single configured LLM provider. If that provider is unavailable the answer generation fails. Provider failover and confidence-thresholding policy are tracked as future work — a failure here is expected behavior, not a bug.

2. **Deprecated contract YAML files.** Separate `ANNOUNCEMENTS_PLUGIN_*_CONTRACTS.yaml` files remain in the repository as intentional historical reference. Their presence is not a bug; they are a known cleanup item.
