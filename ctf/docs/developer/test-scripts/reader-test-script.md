# Reader — manual test script

Reader is a tile and one page. The reader itself is a separate service on its own address, so what
is testable here is small and worth testing precisely: that the tile is in the apps list, that the
page says what a place on the reader costs before anybody goes to it, and that the link leaves the
app the way a link out should.

## How to run this

Work top to bottom on a phone-width window. You will need two accounts: an approved member, and a
signed-in member who is **not** approved. No seed is needed beyond `pnpm --dir ctf run seed:demo`,
since this plugin stores nothing.

The last case leaves the app. Opening the reader is optional for this script — the page's job is to
be right before somebody goes, not to prove the reader works, which its own service covers.

## Core smoke (every session)

1. As the approved member, open the apps list. A tile named **Reader** is there, with a newspaper
   mark, and it is not painted in the fallback gray every unknown plugin gets.
2. Press it. The page opens at `/apps/reader` with a Reader header and a short paragraph saying a
   feed reader collects what sites publish, in the order they published it.
3. Read the three cards. One says the blog and the demo-video channel are already in a new account
   and nothing else is added for you. One says the reader cannot reach back before you start and does not notify you. One says
   what a place on it costs.
4. Read the cost card to the end. It says losing a place is not a ban, that the account in this app
   is untouched, and that not finishing the check never costs anybody their account. If any of those
   three is missing, stop — that is the line the product cannot get wrong.
5. Press **Open the reader**. It opens rss.chargingthefuture.com in a new tab and this tab stays
   where it was.
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

### RD-2 — The page says what a place costs before anybody goes

**Role:** approved member · **Surfaces:** web (phone-width)
**Precondition:** On `/apps/reader`.

**Steps:**

1. Read the card headed "What a place on it costs".

**Expect:** It says the server is paid for; that a place comes from finishing the check on this app
or contributing to what it costs; that places go to those people if the bill makes it necessary;
that losing a place is not a ban and the account here is untouched; and that not finishing the check
never costs anybody their account.

**Why this case exists:** collapsing those two — a place on a paid service and an account here — is
the one thing an agent writing this page keeps doing, and it would have the product telling
survivors that being slow costs them their place. Recorded as an owner decision, 2026-09-23.

---

### RD-3 — The link leaves the app properly

**Role:** approved member · **Surfaces:** web (phone-width)
**Precondition:** On `/apps/reader`.

**Steps:**

1. Read the line under the button.
2. Press **Open the reader**.

**Expect:** The line names rss.chargingthefuture.com and says the sign-in is this same account, so
nobody meets the other address without warning. The button opens a new tab and the app's tab is
unchanged.

---

### RD-4 — Not an Unlock exception

**Role:** signed-in member, not approved · **Surfaces:** web (phone-width)
**Precondition:** Signed in on an account that has not finished Unlock.

**Steps:**

1. Open the apps list and press **Reader**.

**Expect:** The Unlock nudge, not the page. Reader is not on the exception list and must not read as
though it were.
