# Reader — manual test script

Reader is a tile and one page. The reader itself is a free page on another address
(https://chargingthefuture.github.io/rss-feeds/read/), so what is testable here is small and worth
testing precisely: that the tile is in the apps list, that the page says the reader has no sign-in
and keeps the list in the browser before anybody goes to it, and that the link leaves the app the
way a link out should.

## How to run this

Work top to bottom on a phone-width window. You will need two accounts: an approved member, and a
signed-in member who is **not** approved. No seed is needed beyond `pnpm --dir ctf run seed:demo`,
since this plugin stores nothing.

Opening the reader is optional for this script — the page's job is to be right before somebody
goes, not to prove the reader works, which its own repository covers.

## Core smoke (every session)

1. As the approved member, open the apps list. A tile named **Reader** is there, with a newspaper
   mark, and it is not painted in the fallback gray every unknown plugin gets.
2. Press it. The page opens at `/apps/reader` with a Reader header and a short paragraph saying a
   feed reader collects what sites publish, in the order they published it.
3. Read the three cards. One says the blog, the demo-video channel and the recorded broadcasts are
   there to start with, that anything else is added by its address, and that any feed can be
   removed. One says the reader cannot reach back, does not notify you, and cannot add a site that
   does not let other web pages read its feed. One says how to ask for a YouTube channel from + New.
   The intro, the button and each card have clear space between them, and the line naming
   chargingthefuture.github.io/rss-feeds/read sits just under the button. If the cards touch, stop.
4. Read the line under the button. It says there is no sign-in, that what you add and mark stays in
   that browser, and to download a backup there to keep it. Nothing on the page mentions a server
   cost, a place on the reader, or signing in with this account.
5. Press **Open the reader**. It opens https://chargingthefuture.github.io/rss-feeds/read/ in a new
   tab and this tab stays where it was.
6. As the unapproved member, open the apps list and press Reader. The Unlock nudge appears rather
   than the page. This plugin is not an exception and must not behave like one.

---

### RD-1 — The tile is in the list and reaches the page

**Role:** approved member · **Surfaces:** web (phone-width)
**Precondition:** Signed in and approved.

**Steps:**

1. Open the apps list and find **Reader**.
2. Press it.

**Expect:** `/apps/reader` renders with the Reader header, the opening paragraph, the button, and
three cards. Nothing on the page reports an error and nothing is blank.

---

### RD-2 — The page says the list lives in the browser before anybody goes

**Role:** approved member · **Surfaces:** web (phone-width)
**Precondition:** On `/apps/reader`.

**Steps:**

1. Read the line under **Open the reader**.

**Expect:** It says there is no sign-in, that what you add and mark stays in that browser, and to
download a backup there to keep it. It does not tell anybody to keep their browser data.

**Why this case exists:** the reader has no account to fall back on, so the one way to lose a list
is not knowing it lives in one browser. Owner decision, 2026-11-24.

---

### RD-3 — The link leaves the app properly

**Role:** approved member · **Surfaces:** web (phone-width)
**Precondition:** On `/apps/reader`.

**Steps:**

1. Read the line under the button.
2. Press **Open the reader**.

**Expect:** The line names chargingthefuture.github.io/rss-feeds/read, so nobody meets the other
address without warning. The button opens a new tab and the app's tab is unchanged.

---

### RD-4 — Not an Unlock exception

**Role:** signed-in member, not approved · **Surfaces:** web (phone-width)
**Precondition:** Signed in on an account that has not finished Unlock.

**Steps:**

1. Open the apps list and press **Reader**.

**Expect:** The Unlock nudge, not the page. Reader is not on the exception list and must not read as
though it were.

### RD-4b — Signed out, the page does not promise an account is enough

**Role:** signed-out visitor · **Surfaces:** web (phone-width)

**Steps:**

1. Sign out and open `/apps/reader`.

**Expect:** The public preview says Reader has no public view yet and opens once you have an account
and finish verifying it. Nothing on it says a free account is all it takes.
