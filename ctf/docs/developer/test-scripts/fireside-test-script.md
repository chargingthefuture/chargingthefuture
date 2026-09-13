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

### FS-5 — Export is off until the author asks

**Role:** member (approved) · **Surfaces:** web
**Precondition:** An approved member with one public comment.

**Steps:**
1. Open the Fireside screen in the app and find the comment.
2. Read the export control before touching it.
3. Turn it on, then off.
4. Withdraw a different comment that had export turned on.

**Expected:**
- The control is off by default on every comment.
- What it says makes the consequence clear before the choice: turning it on lets the comment be published with the post, where it is searchable and archived, and cannot be withdrawn afterwards.
- Turning it on and off is recorded in the audit trail both times.
- Withdrawing a comment turns its export permission off as part of the same action.
- The control is not offered on a removed or withdrawn comment.

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
- Anything they had exported into the blog's published build is **not** recalled, which is why the export control says so before the choice is made.

Result: web ☐
