# Fireside — manual test script

Fireside is threaded conversation under the posts on the public blog. The thing most worth testing
is the gating, because it is unusual in this app: reading needs no account at all, writing needs a
signed-in member, and nothing written is public until that member is approved.

## How to run this

Work top to bottom. Cases marked **public** must be done signed out, in a private window — a session
left over from another tab is the easiest way to get a false pass on the one case that matters most.

You will need three accounts: an approved member, a signed-in member who is **not** approved, and an
admin.

## Core smoke (every session)

1. Sign out completely. Open a post's conversation and read it. No sign-in prompt, no empty gate.
2. As the unapproved member, leave a comment. It saves, and the screen says it is held until the
   account is approved.
3. Sign out and read the same post again. That comment is not there.
4. Approve that member in Unlock. Read the post signed out again: the comment is now there.
5. As its author, take it down. Signed out, it is gone again.

---

### FS-1 — Reading needs no account

**Role:** nobody · **Surfaces:** web (public)
**Precondition:** A post with at least one comment from an approved member. Signed out, private window.

**Steps:**
1. Request `/api/fireside/threads?repo=<repo>&slug=<slug>`.
2. Read the response.

**Expected:**
- 200, with the comments. No sign-in, no redirect, no 401 or 403.
- Each comment carries a display name. **No user id and no email appear anywhere in the response** — this shape is on the open web.
- `viewer.isSignedIn` is false.
- A post nobody has commented on returns a null thread and an empty list, not an error.
- A request with no repo or no slug is refused with a sentence naming both as required.

Result: web ☐

---

### FS-2 — Writing is held until the author is approved

**Role:** member, not approved · **Surfaces:** web
**Precondition:** Signed in as a member with no Unlock approval.

**Steps:**
1. Post a comment under a blog post.
2. Read the response and any notice on screen.
3. Sign out, open the same post, and look for it.
4. Sign back in as the same member and look again.

**Expected:**
- The comment saves — 201 — and `isPubliclyVisible` is false.
- A notice comes back and is shown, saying it stays private until the account is approved and that a person will read it. It is said at this moment, not left to be discovered.
- Signed out, the comment is not in the thread.
- Signed in as its author, it **is** in the thread. Somebody always sees their own words.

Result: web ☐

---

### FS-3 — Approval is per person and reaches backwards

**Role:** admin, then nobody · **Surfaces:** web
**Precondition:** The member from FS-2 has three held comments on two different posts, and one reaction.

**Steps:**
1. Approve that member in Unlock.
2. Signed out, open both posts.
3. Check the reaction count on the comment they reacted to.

**Expected:**
- All three comments are now public, across both posts, from the single approval. Nothing had to be approved comment by comment.
- Their reaction now counts.
- The queue never had three rows for this person — approval is one decision about a person, not one per item.

Result: web ☐

---

### FS-4 — Removal and approval are separate

**Role:** admin · **Surfaces:** web
**Precondition:** An approved member with one public comment.

**Steps:**
1. Remove the comment as an admin, with a reason.
2. Signed out, read the thread.
3. As the author, open the Fireside screen in the app.
4. Restore it as the admin.

**Expected:**
- Removed, it is gone from the public thread.
- Its author sees it on their own screen labeled as removed by an admin — not as held, which would be untrue.
- Removing also turned its blog-export permission off.
- Restoring puts it back in the public thread.
- Removing a comment whose author is **not** approved works the same way, and that author still reads "removed", not "held".

Result: web ☐

---

### FS-4a — From the blog post to the right conversation, including through sign-in

**Role:** signed-out visitor, then a brand-new member · **Surfaces:** web
**Precondition:** A published blog post. Test once signed out entirely, then again with a brand-new account that has not been approved.

**Steps:**
1. Signed out, and in a browser with no session for the app, open any post on the blog and scroll to the end.
2. Read the conversation section without signing in.
3. Press the button under it.
4. Sign in (or sign up) when asked.
5. Note where you land.
6. Repeat with an account that is signed in but not yet approved.

**Expected:**
- The conversation renders under the post for a signed-out reader, with no account and nothing to dismiss.
- With no comments yet, it says so plainly and the button still invites the first one.
- The button opens that same post's conversation in the app — not the app home, not the member's own comment list.
- After signing in, you are returned to that same conversation. Landing on the home page is the failure this case exists to catch.
- A signed-in but unapproved member reaches the comment box, not a "finish verifying" wall. What they write is saved and held, with the held notice shown at the moment of posting.
- The back control at the top of the conversation reads "Back to the post" and returns to the post you came from — not to your own comment list, which is empty for somebody who has just arrived and is the second way to lose them.
- Open a thread the other way instead, from your own comment list inside the app, and the same control reads "Back to your comments" and goes there. Arriving one way must not change what back means the other way.
- Try it on a post whose address has a folder in it (an archive entry, e.g. `archive/quora/...`): the conversation opens on that post and the back link returns to that same address rather than a broken one.
- With the app unreachable (block the app's domain in the browser, or stop it), the post still reads normally: no error box, and the button still works because it is only a link.

Result: web ☐

---

### FS-5 — Asking for the blog is a request, not a switch

**Role:** member (approved) · **Surfaces:** web
**Precondition:** An approved member with one public comment.

**Steps:**
1. Open the Fireside screen in the app and find the comment.
2. Read the export control before touching it.
3. Turn it on, then off.
4. Turn it on again and leave it on.
5. Withdraw a different comment that had the request turned on.

**Expected:**
- The control is off by default on every comment, and asks rather than publishes: nothing is copied anywhere on turning it on.
- What it says makes the consequence clear before the choice: the comment may be published with the post, where it is searchable and archived, and cannot be withdrawn by anybody afterwards.
- With it on, the comment reads as waiting on an admin. It does not read as published.
- Turning it on and off is recorded in the audit trail both times.
- Withdrawing a comment turns its request off as part of the same action, and takes it out of the admin queue.
- The control is not offered on a removed or withdrawn comment.

Result: web ☐

---

### FS-5a — An admin holds the second key, and a refusal is final

**Role:** admin, then member · **Surfaces:** web
**Precondition:** FS-5 left one comment with its request on.

**Steps:**
1. As an admin, open the Fireside screen and the blog export queue.
2. Read the row, including the line about the author's record.
3. Decline the request.
4. As the author, return to the Fireside screen and try to turn the request on again.
5. As the admin, reopen the queue.
6. Repeat with a second comment, approving it this time.

**Expected:**
- The queue lists only requests whose authors asked, oldest first, paged rather than endless.
- Each row shows the author's record here: comments written, removals, exports declined and approved. An author with a removal or a refusal behind them is flagged, with the note that the account is the decision worth making.
- Declining takes the row out of the queue.
- The author sees that it was declined, and the checkbox will not go back on. The refusal message says the comment stays in the conversation and is not being copied out.
- An approved request also leaves the queue, and the author's screen says approved with the note that switching it off still stops the copy.
- Approving a request whose author then turns their own switch off leaves the comment not exportable — both keys have to be turned at the moment of copying.
- Both decisions are recorded in the audit trail, separately from a comment removal.

Result: web ☐

---

### FS-6 — Taking your own comment down

**Role:** member · **Surfaces:** web
**Precondition:** A member with a comment that has a reply underneath it.

**Steps:**
1. Withdraw the parent comment.
2. Read the thread signed out, then as the author.
3. Ask an admin to try to restore it.

**Expected:**
- The words are gone. The reply underneath is still there and still attached — the row is kept for exactly that reason.
- Signed out, neither the comment nor its text appears.
- The author sees it on their own screen labeled as taken down by them.
- An admin cannot restore a withdrawn comment. Restore is for admin removals only.

Result: web ☐

---

### FS-7 — Replies stop at one level

**Role:** member · **Surfaces:** web

**Steps:**
1. Reply to a top-level comment.
2. Try to reply to that reply.

**Expected:**
- The first reply is accepted.
- The second is refused with a sentence saying replies go one level deep and to reply to the comment above instead. It is refused rather than quietly re-parented — a comment that moves without being asked is worse than one that is turned down.

Result: web ☐

---

### FS-8 — The limits say what they are

**Role:** member · **Surfaces:** web

**Steps:**
1. Submit a one-character comment.
2. Submit one over 4,000 characters.
3. Submit 25 comments in a day, then one more.
4. Press the same reaction twice on one comment.

**Expected:**
- Each refusal names the rule and what to change, rather than only saying no.
- The 26th comment in a day is refused with the number and to come back tomorrow.
- The second press of a reaction removes it rather than counting twice.

Result: web ☐

---

### FS-9 — Your own comments, paged

**Role:** member · **Surfaces:** web
**Precondition:** A member with more than 20 comments.

**Steps:**
1. Open the Fireside screen.
2. Page forward and back.
3. Request a page number past the end.

**Expected:**
- 20 per page, with which range of how many is on screen.
- Previous and Next, and never an endless scroll — this is the accessibility rule, not a preference.
- A page past the end clamps to the last page rather than showing nothing.
- Every row is labeled live, held, removed or withdrawn.

Result: web ☐

---

### FS-10 — Deleting your account

**Role:** member · **Surfaces:** web
**Precondition:** A member with comments and reactions here.

**Steps:**
1. Open the account data screen and read what it says Fireside holds.
2. Delete the account.
3. Read a post they had commented on, signed out.

**Expected:**
- Fireside is listed with the same rights as the Commons, and its summary names comments and reactions.
- After deletion their comments and reactions are gone from the thread.
- The threads themselves remain — a thread is a reference to a blog post, not anything about a person.
- Anything already copied into the blog's published build is **not** recalled, which is why the export control says so before the choice is made and why an admin has to agree before a copy is ever made.

Result: web ☐

---

### FS-11 — The Fireside screen has a way back and a way to the blog

**Role:** member · **Surfaces:** web
**Precondition:** Two members — one who has written here, and one who has written nothing. Use a
phone-width window, which is the width the web app renders at for everybody.

**Steps:**
1. Open the apps list and tap Fireside.
2. Look at the top of the screen.
3. Press the back chevron.
4. Return to Fireside as the member who has written nothing and read the empty state.
5. Press the link to the blog.
6. Open a thread from your own comment list, then use the link at the top of that thread.

**Expected:**
- The screen carries the same header as every other screen: back chevron on the left, the plugin
  icon and the title, and the report-bug / settings / account controls on the right. A screen with
  no back control at phone width is the failure this case exists to catch.
- Back returns to the page you came from — the apps list if that is where you started.
- A link to the blog is on the screen whether or not you have written anything: once beside the
  admin export-queue button at the top, and again in the empty state under the sentence telling you
  to open a post. It opens the blog in a new tab, leaving the app where it was.
- Inside a thread, "Back to the post" and "Back to your comments" still work as FS-4a describes.
  Those move between views within the screen; they are not the screen's back control and neither
  replaces the other.

Result: web ☐

---

### FS-12 — The export feed answers with both keys turned, and nothing else

**Role:** nobody, then admin · **Surfaces:** web (public)
**Precondition:** Five comments from an approved member, one in each of these states: asked and
approved, asked and not yet reviewed, asked and declined, approved and then switched back off by its
author, and approved but since removed by an admin. Plus one asked-and-approved comment whose author
is **not** approved in Unlock. Signed out, private window.

**Steps:**
1. Request `/api/fireside/export`.
2. Read the response.
3. Ask for it again with the `nextCursor` it returned, if it returned one.
4. Request it with a cursor of `nonsense` and with `limit=99999`.

**Expected:**
- Only the asked-and-approved comment from the approved author comes back. All five other states are
  absent — this is the case that catches a feed reading one column and walking past the other key.
- The comment whose author asked and whose admin approved, but who then switched their own request
  off, is not there. Consent withdrawn before the copy stops the copy.
- Each comment carries a display name, the post it belongs under, and its text. **No user id and no
  email appear anywhere in the response** — what this feeds is captured by web archives.
- `scanned` can be larger than the number of comments returned. That is correct: a row refused by
  the rule is scanned and not kept.
- Following `nextCursor` never returns a comment twice and never skips one, including when the
  refused rows sit at the end of a page.
- `nextCursor` is null once the last read came back short.
- A cursor that cannot be read is refused with a sentence saying what a cursor is, not answered from
  the beginning as though it were absent. A limit past the ceiling is clamped rather than honored.
- No sign-in, no 401, no 403. Reading this needs no account, the same as the conversation itself.

Result: web ☐

---

### FS-13 — Closing a conversation stops new comments and hides nothing

**Role:** admin, then member, then nobody · **Surfaces:** web
**Precondition:** A post whose conversation has at least two comments, one with a reply.

**Steps:**
1. As an admin, open that conversation in the app and close it.
2. As a member, open the same conversation.
3. Try to post a comment there anyway, by calling `/api/fireside/comments` directly.
4. Signed out, read the same post on the blog.
5. As the admin, open it again.

**Expected:**
- Every comment already written is still there, for the member and for a signed-out reader alike.
  Closing is not removing, and a case where anything disappears is the failure this catches.
- The member reads a line saying the conversation is closed to new comments and that what is there
  stays. They are not left to work out why the box is gone.
- The comment box is not offered at all on a closed thread. Writing there is refused by the app
  anyway, and a form that always fails is worse than no form.
- The direct call is refused, with a sentence naming the conversation as closed — the screen hiding
  the box is convenience, not the rule.
- Opening it again restores the box, through the same control. Neither direction needs database
  access.
- Both the close and the reopen are in the audit trail, with who did it and when.
- Closing a conversation nobody has commented on yet is refused with a sentence saying a thread
  exists once somebody has commented.

Result: web ☐

---

### FS-14 — Every part of the screen is readable

**Role:** member, then admin · **Surfaces:** web
**Precondition:** A member with at least one comment, one of which has an export request pending.
Use a phone-width window.

**Steps:**
1. Open the Fireside screen and read every section top to bottom.
2. Open "What this room is for".
3. Look at the row's state label, the export request line, and the note under it.
4. Open a conversation and read a comment, its author name, and the Reply control.
5. As an admin, open the blog export queue and read a row.

**Expected:**
- Nothing on any of these screens is smaller than 13px, and the paragraphs people actually read are
  15px.
- The controls are in the plugin's own accent, a warm orange, not gray. A gray control reads as
  disabled, which is what the fallback color made every button on this screen look like.
- The "Showing 1–20 of N" count and the export state note are legible, not near-invisible. Those
  two were in the faintest token in the palette.
- The state label beside each comment — Live, Held, Removed, You took this down — is readable
  against the card.
- Nothing moved. This case is about color and size only; a layout or copy change here is a
  regression, not an improvement.

Result: web ☐

---

### FS-16 — The admin list of every comment, and its page in the address bar

**Role:** admin · **Surfaces:** web
**Precondition:** More than 20 comments across at least two posts, including one already removed by
an admin and one already taken down by its author.

**Steps:**
1. Open the Fireside screen as an admin and press Recent comments.
2. Read the first page, then page forward.
3. Look at the address bar. Copy the link, open it in a new tab.
4. Press the browser back button.
5. Edit the address to a page number far past the end and load it.
6. Remove a live comment from this list, then put it back.
7. Find the comment its author took down.

**Expected:**
- Newest first, 20 to a page, with which range of how many on screen.
- Removed and withdrawn comments are in the list, not hidden. An admin list that shows only live
  comments cannot be used to undo anything, which is the failure this case exists to catch.
- The page number is in the address bar, and the copied link opens on that same page.
- Back returns to the previous page of the list rather than leaving the screen.
- A page past the end lands on the last page with rows on it, not on an empty screen.
- Removing works from here, and the removed row stays in the list with "Put it back" on it, which
  restores it. Both are in the audit trail.
- The comment its author took down has no control on it at all, and says so. An admin cannot
  restore a withdrawal, and a button that always fails is worse than no button.
- Removing from here also cancels any request to publish that comment with the post.

Result: web ☐

---

### FS-17 — Searching what people wrote

**Role:** admin · **Surfaces:** web
**Precondition:** Comments including one containing the word `rebuilding`, one containing the exact
phrase `what was done`, one containing an apostrophe (`it's`), and at least 25 matching a common
word so the results page.

**Steps:**
1. Open Recent comments as an admin and search for `rebuilding`.
2. Search for the quoted phrase `"what was done"`.
3. Search for `it's`.
4. Search for a common word, then page through the results.
5. Search for something no comment contains.
6. Clear the search.
7. Search for an author's name, and for a post title.

**Expected:**
- The word search finds the comment, and finds it whatever case it was typed in.
- The quoted phrase matches only comments with those words together, not comments that merely
  contain all three somewhere.
- `it's` returns results rather than an error. A search box that breaks on an apostrophe is the
  failure this case exists to catch — the raw tsquery function throws on exactly that input.
- The count says how many matched and the pager pages through them. The number on screen matches
  the number of rows you can actually reach by paging.
- A search with no matches says so and says what it searches, rather than showing an empty screen.
- Clearing returns to the full list, on page one.
- A name or a post title finds nothing, and the empty message says it searches what people wrote.
  That is the current behavior, not a bug — worth knowing before somebody reports it as one.
- A member has no search anywhere. This is an admin tool; a search across every thread for a member
  would be the browse view that is tabled.

Result: web ☐

---

### FS-18 — Being told somebody answered you

**Role:** two members and an unapproved member · **Surfaces:** web
**Precondition:** An approved member with a comment on a post. A second approved member, and a
third who is signed in but not yet approved.

**Steps:**
1. As the second member, reply to the first member's comment.
2. As the first member, open the notifications feed.
3. Press the notification.
4. As the first member, reply to your own comment, then check your own feed again.
5. As the unapproved member, reply to the same comment. Check the first member's feed.
6. Approve that third member in Unlock. Check the feed again.
7. As the second member, post a new top-level comment on the same post, not a reply.

**Expected:**
- The first member is told somebody replied. The text names no content and no person — it can land
  on a lock screen, so it says nothing that would matter to somebody reading over a shoulder.
- Pressing it opens that conversation, not the app home and not their own comment list.
- Replying to your own comment tells you nothing. In a conversation that has just started this is
  most replies, and a feed full of your own replies is a feed nobody reads.
- The unapproved member's reply notifies nobody, because nobody else can see it yet. A notification
  pointing at something the recipient opens and cannot find is worse than none.
- Approving that member makes the reply appear, and **no notification arrives late**. That is the
  current behavior and a recorded gap, not a bug to file — catching it up needs a hook into Unlock
  approval.
- A new top-level comment notifies nobody. It answers nobody.
- With notifications unreachable or misconfigured, posting a reply still succeeds. The comment is
  the thing that matters; being told is best-effort.

Result: web ☐
