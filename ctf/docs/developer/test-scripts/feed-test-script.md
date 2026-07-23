# Commons (Feed & Announcements) — Manual Test Script

> **Android: not applicable.** Commons is web-only (rule 105) — the native app has no Commons surface.
> Test on web only: desktop and the mobile-responsive (~390px) layout.

> Walk these steps on a real device to confirm the plugin works end to end. This script is the
> runnable counterpart of the feature inventory
> (`ctf-feed-feature-inventory.md`) — those files are the source of truth; do not edit a step here to
> match a bug, fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- feed`

| | |
|---|---|
| **Plugin** | Commons — Feed & Announcements (`feed`) |
| **Visibility** | Member-facing (the home Commons); admin announcement tools |
| **Roles to test** | member · admin · signed-out visitor |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-feed-feature-inventory.md` |
| **Generated** | 2026-07-23 (initial authoring, by hand — wiring feed into the test-script manifest) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line.
- Run the **Core smoke** block every session; run the full walkthrough when you changed this plugin.

---

## Core smoke (every session)

The home Commons is the community's front door — these are the can't-ship-broken checks. Member role
unless noted.

1. **Commons loads.** Open the home Commons as a signed-in member. The blended timeline (community
   posts, announcements, any @comic answers) renders with a composer at the bottom — not a spinner or
   an error. → web ☐ mobile ☐
2. **Post a message.** Type in the composer ("Share with the community…") and send. Your post appears
   in the stream and persists on reload. → web ☐ mobile ☐
3. **Delete + edit your own post.** On your own post, use **Delete** (confirm) — it disappears. Post
   again, then use **Edit**: the text loads back into the composer and the original is removed; send to
   repost. The reposted message is a fresh row with a new timestamp (no inherited reactions/replies).
   → web ☐ mobile ☐
4. **Signed-out view.** Open the Commons while signed out. You see community posts read-only (when
   public viewing is on) or a sign-in prompt — never a composer, AI, or per-user data. → web ☐ mobile ☐

---

## Member walkthrough

### FD-1 · Post, reply, react
**Role:** member · **Surfaces:** all
**Steps:**
1. Post a community message.
2. On another member's post, use **Reply** (Signal-style quote) and send a reply.
3. Toggle an emoji reaction (👍 ❤️ 😂 🎉 🙏 😢) on a post; toggle it again to remove.
**Expected:** The post, the quoted reply, and the reaction all appear and persist on reload. A second
toggle of the same emoji removes your reaction. Reactions are stored in our database, not Stream.
**Result:** web ☐ mobile ☐ — notes:

### FD-2 · Delete your own post
**Role:** member · **Surfaces:** all
**Steps:**
1. On your own post, press **Delete** and confirm the dialog.
2. Try to find a Delete control on someone else's post.
**Expected:** Your post is removed for everyone (author-only; the server rejects deleting another
member's post). No Delete control appears on other members' posts.
**Result:** web ☐ mobile ☐ — notes:

### FD-3 · Edit your own post (edit = delete + repost)
**Role:** member · **Surfaces:** all
**Steps:**
1. On your own post, press **Edit**.
2. Fix the text in the composer and send.
**Expected:** Edit loads the post's text into the composer and deletes the original; sending posts a
fresh message with a **new timestamp** and its own moderation — no in-place edit, no inherited
reactions or replies. Any active reply is cleared when you press Edit.
**Result:** web ☐ mobile ☐ — notes:

### FD-4 · Ask the AI Assistant (@comic) with consent
**Role:** member · **Surfaces:** all
**Steps:**
1. In the composer, mention `@comic` with a question and send.
2. On first use, confirm the AI-processing consent modal.
**Expected:** The message routes to the AI Assistant (not posted as a peer message); a "Reviewing for
safety" pending card shows, then the answer. "Not now" on the consent modal keeps the question in the
composer instead of sending. Answers can be rated.
**Result:** web ☐ mobile ☐ — notes:

### FD-5 · Announcements in the stream
**Role:** member · **Surfaces:** all
**Precondition:** at least one published announcement (seeded or admin-created).
**Steps:**
1. Read an announcement card in the timeline.
2. React to / acknowledge it if the card offers it, and reload.
**Expected:** Published announcements render as cards woven into the timeline; your read/ack state
persists. Draft (unpublished) announcements never appear to members.
**Result:** web ☐ mobile ☐ — notes:

### FD-6 · Mentions-only and filters
**Role:** member · **Surfaces:** all
**Steps:**
1. Have another member @-mention your handle in a post.
2. Toggle the **mentions-only** filter; toggle **announcements-only**.
**Expected:** The mentions filter narrows the stream to posts mentioning you; the announcements filter
narrows to announcements. Toggling off restores the full stream. Filtering does not lose your draft.
**Result:** web ☐ mobile ☐ — notes:

---

## Admin walkthrough

### FD-A1 · Create, edit, publish, archive an announcement
**Role:** admin · **Surfaces:** web (desktop) · mobile-responsive
**Steps:**
1. In the admin announcements surface, create a draft (title, body, optional linked plugin).
2. Use **Edit** on the draft to change it, then **Save changes**.
3. **Publish** the draft; confirm it appears in the member Commons.
4. **Archive** a published announcement.
**Expected:** Draft create/edit is admin-only and never shows to members until published. Editing is
offered on drafts only (the update command rejects non-draft rows). Publish makes it visible in the
member timeline; archive removes it from the member view. Each action is audited.
**Result:** web ☐ mobile ☐ — notes:

---

## Parity check (web ↔ mobile-responsive)

Commons is web-only (no native Android surface). Confirm the desktop and ~390px phone-width layouts
both render the timeline, composer, and the Reply / Edit / Delete controls without clipping, and that
the audio-room controls are not part of this surface (Commons is text-only).

---

## Known gaps — do not file these as bugs

- No native Android Commons surface (web-only per rule 105).
- There is no in-place edit by design: a correction is always delete + repost (a fresh row, new
  timestamp, own moderation, no inherited reactions/replies).
