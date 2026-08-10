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

2. **Commons home loads.** Sign in as a member. Navigate to the Commons home. The feed timeline renders with at least one item (announcement, question, or community post) and no unhandled error is shown. web ☐

3. **Admin page loads.** Sign in as an admin. Navigate to `/admin/feed-announcements`. The page renders with a feed config panel and an announcement list. No 404 or 500. web ☐

4. **`/apps/feed-announcements` is gone.** With any authenticated session navigate to `/apps/feed-announcements`. Expect a 404 — the member-facing app shell was removed. web ☐

5. **Public community route works unauthenticated.** Sign out completely. `GET /api/feed/public/community` returns `{ isPublic: true, posts: [...] }` (or `isPublic: false` if the community channel is disabled in config). No authentication error. web ☐

---

## Member walkthrough

### FD-1 — Timeline loads across all channels
**Role:** member | **Surface:** web

**Precondition:** Signed in as a member. Seed has run (`pnpm --dir ctf seed:demo`).

**Steps:**
1. Navigate to the Commons home.
2. Observe the default feed — all channels.
3. Use the channel filter to switch to **Announcements**.
4. Switch to **Questions**.
5. Switch to **Community**.
6. Switch back to **All**.

**Expected:**
- Default view shows items from multiple channel types (announcement cards, question cards, community posts) in reverse-chronological order.
- Each filter shows only items of that type; no items from other channels appear.
- API check (optional): `GET /api/feed/items?mentions=me` returns only items that @-mention the
  signed-in caller (same behavior as the Hub "@ Mentions" toggle); any other `mentions` value
  returns 400.
- Switching back to All restores the blended view.
- No loading spinner stays permanently; empty state message shows if a channel has no items.

**Result:** web ☐

---

### FD-1b — Member block hides a person's Commons posts and replies (added 2026-08-05)

**Role:** two members (A and B) · **Surfaces:** web

**Precondition:** B has authored at least one community post and one reply on someone else's post. A blocks B (from B's Directory profile or `/account/blocks`).

**Steps:**
1. As A, open the Commons and scroll the timeline.
2. As A, open a post that B replied to.
3. As B, open the Commons and look for A's posts.
4. As an admin, open the Commons moderation admin and check the full post list.

**Expected:**
- Steps 1–3: B's posts and replies do not render for A, and A's do not render for B (both directions). Announcements and AI answers always show — they have no member author.
- A post's reply counter may read higher than the replies shown to a member with a block — accepted, not a bug.
- Step 4: admin/moderation views are never filtered.
- Neither member gets any signal that a block exists.

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
5. Confirm the name on the card reads **Farah** — not "Survivor Hub" — and that the shield "Official" badge still sits beside it (added 2026-08-09). The name says who wrote it, the badge says it is official; both must be present.
6. Confirm the round avatar on the card reads **F**, the first letter of that name, and that no card anywhere in the stream shows the old fixed **SH** glyph. Scroll a peer post into view and confirm its avatar is likewise the first letter of its author's handle.

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
- If you inspect the network call, the read-mark response carries a `readAt` timestamp — the value the
  database stored, not a client guess. The announcement read-mark endpoint
  (`POST /api/announcements/:id/read`) reports its stored `readAt` the same way.

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
- (API-level, if inspecting the response) the `dismissedAt` value in the dismiss response is the
  timestamp the database stored, not one the route computed — it matches the persisted row.

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
5. Now paste a post that is exactly 1,201 characters long.
6. Watch the line under the composer as you approach and pass the limit, then press send.
7. Delete one character and check the line again.

**Expected:**
- The valid post appears in the feed attributed to the correct member handle.
- From roughly 1,050 characters the composer shows "N characters left"; past 1,200 it turns red and
  reads **"1 character over the limit — remove it to post."** (at 1,201), naming the exact number to
  cut rather than a raw "1,201 / 1,200" count.
- The send button is **disabled** while over, so the post cannot be attempted at all.
- **The message is never lost.** If a send does fail (force one by shrinking the cap, or by going
  offline), the text comes back into the composer rather than being cleared — unless you have already
  started typing something new, which is never overwritten.
- Indentation and double spaces do not count against you: the counter measures the same
  whitespace-normalized text the server measures, so a post padded with spaces or blank lines is not
  falsely reported as over.
- As an **admin**, the cap is 4,000 and the counter reflects that — it must not warn at 1,200.
- An `@comic` question shows no counter (it goes to the AI Assistant on a different route with its
  own limit).

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
8. Try to submit an emoji not in the set (e.g., 🚀) via the API directly (`POST /api/commons/messages/:postId/reactions` with `{ emoji: "🚀" }`).

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
2. Attempt to react to it (open picker and tap an emoji, or call `POST /api/commons/messages/:postId/reactions`).

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
1. Navigate to the Commons home (or call `GET /api/feed/public/community`).
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

### Account deletion clears reactions and Hub read-state

**Expected:** Deleting the account removes the member's post reactions, announcement reactions, and
`feed_commons_last_seen` row along with the per-user state the script already covers.

### FD-25 — Account deletion removes the posts themselves, not just the author's name

**Role:** member (or an admin on a throwaway account) | **Surface:** web

**Steps:**
1. From the account under test, post two messages in the Commons and note their exact text.
2. Delete the Commons data from Account & Data (or delete the whole account, on a throwaway
   account).
3. Reload the Commons in a signed-in session and scroll to where those messages were.
4. Run the deletion a second time and reload again.

**Expected:**
- The message text is **gone**. It must not still be on screen under a substituted author name —
  in particular not the fallback handle `user-hub-syst`, which is what a leftover timeline copy
  with no author resolves to.
- Official announcements from the operator are untouched and still read normally.
- Replies and reactions that hung off those messages are gone with them.
- The second deletion finds nothing left to remove and changes nothing on screen.

**Result:** web ☐

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
1. In the Commons composer (or via `POST /api/commons/messages`), compose a community post of 2,000 characters (well above the 1,200-character member cap).
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

### FD-A24 — The public-rooms notice on a member's first visit
**Role:** new member | **Surface:** web

**Precondition:** An account that has never opened the Commons, or delete that member's row from
`feed_commons_notice_seen`.

**Steps:**
1. Sign in as that member and open the Commons.
2. Read the card at the top of the stream, then click **Got it**.
3. Reload the Commons.
4. Sign in as a member who has already dismissed it and open the Commons.
5. Sign out entirely and open the Commons.
6. Check `SELECT * FROM feed_commons_notice_seen`.

**Expected:**
- Step 1: a short card titled **Before you post** appears at the top of the stream — **not a modal**. A
  box demanding a click over a support channel trains people to dismiss it unread, and these members
  have every reason to distrust one.
- **It is short and it does not scroll.** Check at phone width: the card fits without its own scrollbar,
  the Commons header stays on screen, and the message list below it is still the part that scrolls. The
  first build put the FULL notice in this card — it filled the screen, pushed the header off, and left
  the member scrolling the conversation past it into empty space. The card is a heads-up (this room is
  public, the assistant is not); the long version arrives on the rotation, where length is free because
  an announcement scrolls with the chat instead of sitting on top of it.
- Step 2/3: gone, and it stays gone.
- Step 4: not shown.
- Step 5: not shown to a signed-out visitor — they cannot post, so there is nothing yet to disclose.
- Step 6: one row per member per notice.
- The point of this case: the cadence alone cannot protect a member who posts something identifying on
  their first visit, before any rotation reaches them. If this card stops appearing for new members, that
  protection is gone even though the periodic notice still looks fine.
### FD-A21 — A flagged answer reaches an admin, and can be hidden
**Role:** member + admin | **Surface:** web

**Precondition:** A question in the Commons with at least one answer.

**Steps:**
1. As a member, open the answer and rate it **flagged**.
2. As a second member, flag the same answer.
3. As admin, open `/admin/commons` and look at the tab row.
4. Open the **Flagged answers** tab.
5. Click **Hide answer**.
6. As a member, reload the Commons and find the question.
7. Back in the admin tab, click **Put back** and accept the confirmation.

**Expected:**
- Step 3: the tab reads **Flagged answers (1)** — the count of flagged answers still visible. Before
  this shipped, a flag went nowhere at all: the count was aggregated by an admin route that no screen
  ever called.
- Step 4: the answer is listed with **2 flags**, the parent question above it, and a pill saying whether
  it came from the assistant or a member. Ordering is by flag count, not date — triage, not a feed.
- Step 5/6: the answer is gone from the member's view of that question, and **the question is still
  there**. That matters: the member who asked keeps their question and can still get a better answer.
- Step 7: the answer is visible again, and the pending count returns to 1.
- Check the audit log: the transition carries `previousStatus`, `newStatus`, and the reason. Not the
  answer body.

**Result:** web ☐

---

### FD-A23 — The other two notices, on their own cadences
**Role:** admin | **Surface:** web

**Precondition:** As FD-A19. For the time-cadence case you need either database access to
`feed_commons_guidance_milestones` or a local build with `FEED_COMMONS_SIGNAL_INTERVAL_DAYS` lowered.

**Steps:**
1. Post until the Commons post count reaches a multiple of 75.
2. Read the stream.
3. Delete the `signal_vs_noise` row from `feed_commons_guidance_milestones`, then post once.
4. Post several more times in the same day.
5. Check `SELECT notice_key, milestone_count FROM feed_commons_guidance_milestones`.

**Expected:**
- Step 2: **Where things are public, and where the work happens** appears. Two things to verify in it:
  - It says the group chat **and the main Chyme room** are public — anyone can read and listen signed
    out, and you sign in to comment or speak. Check this against the app by opening `/apps/chyme` in a
    signed-out window: you should get the guest listen view, not a redirect. (Reading only the
    authenticated branch of `app/apps/[pluginSlug]/page.tsx` makes Chyme look gated. It is not — the
    public-visitor registry serves `ChymePublicShell`.)
  - The AI Assistant paragraph says the owner sees the question when checking an answer, rather than
    promising nobody ever reads them. If that drifts back to an absolute promise, the notice is claiming
    more privacy than the code gives.
- Step 3: **Who I interact with is not a vouch** appears on the very next post — a time-cadence notice is
  delivered by a post, not by a clock, so nothing is published into a silent room.
- Step 4: no repeats. Every post that day computes the same period and loses the claim.
- Step 5: rows are keyed by `notice_key` — the three notices never share a period row and never block
  each other.
- Read the signal notice and confirm it says **Skills Economy**, never "TI Skills Economy (TSE)", and
  uses "Target" rather than "TI" as a label.

**Result:** web ☐

---

### FD-A25 — Notice text renders as paragraphs, never chopped mid-sentence
**Role:** any member | **Surface:** web (check at phone width — that is where it showed)

**Precondition:** A published standing notice visible in the Commons, and a member who has not dismissed
the first-visit card.

**Steps:**
1. Open the Commons at phone width and read the first-visit card top to bottom.
2. Read a published notice in the stream (the announcement card).
3. Look specifically at the ends of lines within a paragraph.
4. Find an announcement that carries a trailing "Open <Plugin>: <url>" block and read it.

**Expected:**
- Sentences wrap where the column runs out and **nowhere else**. No sentence is cut mid-clause with the
  rest starting a new line ("whether or / not they have an account"). This is what reached members once:
  the copy was authored as source-wrapped lines joined with `\n`, and `white-space: pre-wrap` turned
  every one of those into a hard break.
- Paragraphs are separated by real spacing, not by an empty line of text.
- Step 4: the "Open <Plugin>" lines stay on **separate** lines. They are a deliberate list, not wrapped
  prose, and the renderer must keep them apart while joining prose that was only source-wrapped.
- Run `pnpm --dir ctf check:notice-formatting` — it fails if any notice body is built by joining lines
  with a single `\n`, which is the authoring mistake behind all of this.
- Run `pnpm --dir ctf preview:member-copy` — it renders every standing notice and the first-visit card
  to PNGs at phone width in `ctf/artifacts/copy-preview/`, marks the phone fold, and **exits non-zero if
  the first-visit card is taller than the screen**. Attach those PNGs to any PR that changes
  member-facing copy. Both defects here — chopped sentences, and a card that swallowed the screen — were
  obvious at a glance and invisible to every automated check, because none of them look at the output.

**Result:** web ☐

---

### FD-A19 — Commons guidance notice posts itself every 50 posts
**Role:** admin + member | **Surface:** web

**Precondition:** You can read the total row count of `feed_community_posts`. Pick a starting count
where you can reach the next multiple of 50 without posting hundreds of times — or temporarily lower
`FEED_COMMONS_GUIDANCE_INTERVAL` in a local build to make this practical.

**Steps:**
1. Note `SELECT COUNT(*) FROM feed_community_posts`.
2. Post in the Commons until the total lands exactly on a multiple of the interval.
3. Read the Commons stream at that point.
4. Post one more time and read the stream again.
5. Check `SELECT milestone_count, announcement_id FROM feed_commons_guidance_milestones`.
6. Hide one of the posts you made, then post again up to the next multiple.

**Expected:**
- Step 3: an announcement titled **What the Commons is for** appears inline in the Commons stream. It
  is attributed to the system, **not** to you and not to any member — nobody should look like they are
  personally telling people off every 50 posts.
- Step 4: no second copy. The notice fires on the milestone itself, not on every post past it.
- Step 5: one row for that milestone, with `announcement_id` filled in, so the exact announcement a
  milestone produced can be found later.
- Step 6: hidden posts still count. The milestone means "the Commons has seen this much traffic";
  moderating after the fact must not shift where the next notice falls.
- Read the copy and check all five of these survive. Each was corrected into place by the owner, and
  losing any one of them changes what the notice does:
  1. The Commons is a **support channel** — ask in the open, get an answer. It is **not** where trades
     are arranged or recorded; those live in their own apps and are what count toward the economy. If
     the notice ever implies otherwise it teaches members to do business in a public thread instead of
     in the app that records it.
  2. **Why it is open**, stated as the benefit: a public question is answered once where the next person
     finds it, by whoever is awake across the timezones, so nobody waits on the owner alone. The copy
     deliberately does **not** explain the harassment history behind the no-DM policy (cut 2026-07-30) —
     the rule stands on the benefit, and the notice does not owe the community that account.
  3. **"You can say what is happening to you."** This is the anti-scare guarantee. Without it, "no
     storytelling" reads to a newly targeted person as *your experience is unwelcome here*, which is the
     opposite of true and would cost the app exactly the members it is for. The line it draws is the
     retelling that asks for nothing, contrasted with Quora — where you narrate into a void.
  4. Content is removed for **repeatedly going nowhere**, never for who someone is suspected of being.
  5. Traffickers are **"not allowed"** — as a fact, not "not tolerated" as a feeling.
  6. The Weaver perk is **the private room**, not the Commons. Check the notice does not claim Weavers
     post without restriction *here* — the topic rule applies to the Commons for everyone, and an earlier
     draft got this wrong. Promising members something the app does not do is worse than any tone problem.
  7. **It reads as a pitch, not a telling-off.** It opens on the Quora contrast (there you write into a
     void; here you ask and someone answers) and the rules follow as consequences of that promise. If an
     edit ever makes it lead with the rules, it will read as annoyed and cost the app the members it is
     for — the firmness on traffickers is not the same thing as a scolding tone toward everyone else.

**Result:** web ☐

---

### FD-A20 — The notice cannot post twice for one milestone
**Role:** admin | **Surface:** web

**Precondition:** As FD-A19, sitting one post below a multiple of the interval.

**Steps:**
1. With two browser sessions signed in as two different members, submit a Commons post from both at
   essentially the same moment — the two requests should straddle the milestone boundary.
2. Read the Commons stream.
3. Check `SELECT COUNT(*) FROM feed_commons_guidance_milestones WHERE milestone_count = <the multiple>`.
4. Now force a failure: post while the database is briefly unreachable, or otherwise cause the post to
   fail. Then post successfully up to the same milestone.

**Expected:**
- Step 2/3: exactly **one** notice and exactly **one** milestone row. The UNIQUE constraint on
  `milestone_count` is what guarantees this — both requests compute the same count and try to claim it,
  and only one insert survives.
- Step 4: the milestone is still served. A post that rolled back must not leave a claimed milestone
  behind, because that would silently suppress that notice forever. This is why the claim shares the
  post's transaction rather than running after it commits.
- In every case, a failure in the notice must never cost a member their post. If the notice cannot be
  published, the post still succeeds.
### FD-A22 — A hidden question stops being answerable and stops feeding training
**Role:** member + admin | **Surface:** web

**Precondition:** A question in the Commons with LLM consent granted and no answer yet.

**Steps:**
1. As admin, open `/admin/commons`, find that question and hide it.
2. As the member who asked, reload the Commons.
3. Attempt to generate an answer for it (`POST /api/feed/questions/<id>/answer`).
4. As admin, run the training export (`GET /api/comic/training/export` / the questions export) and search
   it for the hidden question's text.
5. Put the question back and repeat step 4.

**Expected:**
- Step 2: the question is gone from the timeline.
- Step 3: refused as **not found** — not "forbidden". A hidden question must not confirm it exists.
- Step 4: the hidden question does **not** appear in the export. This is the check that matters: hiding
  something is a judgment it does not belong, and exporting it into training data would launder it back
  in, with the model then answering in the register of the thing that was removed.
- Step 5: it appears again once restored.

**Result:** web ☐

---

### FD-A17 — Off-topic sweep: reason is recorded, and restoring clears it
**Role:** admin | **Surface:** web

**Precondition:** Several visible Commons posts, at least two of them off topic (Quora-style discussion
with nothing to do with the economy — this is the common case).

**Steps:**
1. Open `/admin/commons`. Note the **Hide reason** picker above the list and what it defaults to.
2. Without changing the picker, click **Hide** on two different off-topic posts in a row.
3. Read the Hidden pill on each.
4. Change the reason to **Abusive** and hide a third post.
5. Click **Put back** on one of the off-topic posts and accept the confirmation.
6. Hide that same post again.

**Expected:**
- Step 1: the picker defaults to **Off topic — not about the economy**. It is one picker for the whole
  list, not one per row — a sweep of twenty posts must not mean twenty identical selections.
- Step 2/3: both hidden pills read `Hidden · Off topic — not about the economy`. The reason was not
  re-selected between them.
- Step 4: that pill reads `Hidden · Abusive`, and the earlier two are unchanged.
- Step 5: the post returns to the member Commons **and** its stored reason is cleared — when it next
  appears in the list it carries no reason text. A visible post must never show a standing accusation.
- Step 6: it is hidden again with whatever reason the picker currently holds.
- Check the audit log: each real transition carries `previousStatus`, `newStatus`, and `reason`. Never
  the post body.

**Result:** web ☐

---

### FD-A18 — Moderate by member
**Role:** admin | **Surface:** web

**Precondition:** At least two members have posted in the Commons, one of them several times.

**Steps:**
1. Open `/admin/commons` and switch to the **By member** tab.
2. Read the ordering and the per-member counts.
3. Click the member with the most posts.
4. Read the banner above the list, then hide one of their posts.
5. Click **Back to members**.

**Expected:**
- Step 2: members are ordered by how much they have posted, each showing post count, reply count, how
  many are already hidden, and first/last posted dates. **No post bodies appear on this tab** — deciding
  whether to look at someone should not require reading everything they wrote.
- Step 3/4: the list narrows to that member's entire footprint, posts and replies, and the banner names
  them with their counts. Hiding works exactly as on the Recent tab and the view stays on that member
  afterwards — it must not bounce you back to the full list mid-sweep.
- Step 5: the roster is still populated (a single-member request returns an empty roster by design;
  the surface must not blank the list you came from).
- There is deliberately **no bulk "hide everything from this member"** control. Confirm it is absent:
  one click clearing a member's whole history on a wrong hunch is the failure being avoided.

**Result:** web ☐

---

### FD-A14 — Hide a Commons post, then put it back
**Role:** admin + member | **Surface:** web

**Precondition:** At least one member-authored Commons post exists with at least one reply. Have a
second browser window signed in as a different member (or signed out) so you can watch the member view.

**Steps:**
1. As admin, open `/admin/commons` (it is listed as **Commons Moderation** on the admin landing page).
2. Find the post in the Recent list. Click **Hide**.
3. In the member window, reload the Commons.
4. Sign out entirely and load the public Commons view, if public viewing is enabled.
5. Back in the admin window, switch to the **Hidden only** tab.
6. Click **Put back** and accept the confirmation.
7. Reload the member window again.
8. Click **Hide** twice in a row on any post — once to hide it, then hide it again without reloading.

**Expected:**
- Step 2: the row gains a "Hidden" pill and the Hidden-posts counter goes up by one.
- Step 3: the post is **gone** from the member timeline — and so are its replies, since the whole item
  drops out. This is the check that matters: before this feature the status column was ignored, so a
  hidden post stayed visible.
- Step 4: it is absent from the signed-out public list too, not just the member view.
- Step 5: the hidden post is listed there — hiding must not be a one-way door.
- Step 6/7: the post is back in the member timeline, replies and all. Nothing was deleted.
- Step 8: the second hide reports "Already in that state — nothing changed." Check the server log: the
  no-op writes **no** second `feed.community.moderation.hide` audit entry. The trail must never claim a
  transition that did not happen.
- Nowhere in this surface is there a control to **edit** the post. That absence is deliberate — confirm
  it is still absent.

**Result:** web ☐

---

### FD-A15 — Hide a Commons reply on its own
**Role:** admin + member | **Surface:** web

**Precondition:** A visible Commons post with at least two replies.

**Steps:**
1. As admin, open `/admin/commons` and find one **Reply** row (it carries a "Reply" pill and shows which
   post it belongs to).
2. Click **Hide** on that reply only.
3. In the member window, reload the Commons and open the parent post's replies.

**Expected:** Only that one reply is gone. The parent post is still visible and its other replies still
render. Hiding a reply must not take the post or its siblings with it.

**Result:** web ☐

---

### FD-A16 — Only an admin can moderate
**Role:** member | **Surface:** web

**Steps:**
1. Signed in as an ordinary member, navigate to `/admin/commons`.
2. With the browser dev tools, `POST /api/feed/admin/moderation/post/<any-post-id>` with body
   `{"hidden":true}` and the `x-ctf-csrf: 1` header.
3. Repeat the POST with the header omitted.
4. Repeat as admin but with the body `{}` (no `hidden` field).

**Expected:** Step 1: redirected away, no moderation UI. Step 2: rejected, and the post stays visible.
Step 3: rejected for CSRF. Step 4: 400 — a missing `hidden` field must be an error, never a silent
"restore", so a malformed request can never put hidden content back in front of members.

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
6. Check the audit log after the valid calls in step 1 and step 3.

**Expected:**
- Valid payloads return `ok: true`.
- Missing required fields return 400.
- Non-admin caller is rejected with 403.
- Each valid call writes one `feed.membership.event.emit` audit row that records the acting admin,
  the target member (`userId`), the plugin, and the event type. A call that fails to emit still
  writes the audit row with a failure result — the admin-only command never runs without leaving a
  trail.

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

### Account deletion clears replies and AI-log rows

**Expected:** Deleting the account removes the member's replies to announcements and any AI-answer
log rows carrying their id (most already cascade away with their deleted questions and answers).
Admin-authored announcements and feed items are unaffected.

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
