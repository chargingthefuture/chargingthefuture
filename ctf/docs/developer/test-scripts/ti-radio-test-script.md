# TI Radio — manual test script

TI Radio is a published schedule of live discussions members host in Chyme. Two things are most
worth testing, because both are unusual in this app: the page is readable with no account at all,
and two people pressing the same empty slot at the same moment must produce one booking and one
honest refusal.

## How to run this

Work top to bottom. Cases marked **public** must be done signed out, in a private window — a session
left over from another tab is the easiest way to get a false pass on the case that matters most.

You will need three accounts: an approved member, a signed-in member who is **not** approved, and an
admin. Seed some rows first with `pnpm --dir ctf run seed:ti-radio`.

## Core smoke (every session)

1. Sign out completely. Open `/ti-radio`. The week of slots renders, with times in your own timezone.
   No sign-in prompt and no gate.
2. As the approved member, scroll down to a slot near the end of the week and press it. The form
   comes into view on its own and the cursor is already in the subject field. Write what it is
   about and take it. Your handle and subject appear on that row.
3. Sign out and open the page again. The booking is there, with the handle and subject.
4. Sign back in as the host and give the slot back. It returns to the guide as open.
5. As the unapproved member, open the page. The schedule is all there, and the only thing on offer is
   "Finish verifying to host".
6. Still signed out, read the intro card at the top. It says a slot is taken rather than granted,
   that nobody reviews a description first, that a name is not an endorsement and this project does
   not vouch for a host or for what gets said in their room, and that the rules still apply in the
   room. It does **not** say the room is moderated, screened or safe — that would be a claim the
   product cannot back, and a reader deciding whether to turn up is worse off believing it.

---

### TR-1 — Reading needs no account

**Role:** nobody · **Surfaces:** web (public)
**Precondition:** At least one booked slot. Signed out, private window.

**Steps:**
1. Open `/ti-radio`.
2. Request `/api/ti-radio/guide` directly.

**Expected:**
- The page renders the week. No sign-in, no redirect, no 401 or 403.
- 200 from the route, with every slot start in the window — booked and open alike.
- Each booking carries a handle, a subject, and possibly a description. **No user id appears anywhere
  in the response**, and nothing about who is listening.
- `guide.viewer.isSignedIn` and `guide.viewer.canHost` are both false.
- The first slot in the list is the one covering right now, not the next one.

Result: web ☐

---

### TR-2 — /apps/ti-radio reaches the guide, signed out

**Role:** nobody · **Surfaces:** web (public)
**Precondition:** Signed out, private window.

**Steps:**
1. Open `/apps/ti-radio`.

**Expected:**
- Redirected to `/ti-radio` and the schedule renders.
- **Not** the generic plugin sign-in card, and not the access-denied page. If either appears, the
  redirect has moved below the access gate.

Result: web ☐

---

### TR-3 — Booking a slot

**Role:** member, approved · **Surfaces:** web
**Precondition:** Signed in as an approved member, with an empty slot on the guide.

**Steps:**
1. Press an empty row.
2. Leave the subject blank and try to submit.
3. Write a subject and a description, and take the slot.
4. Read the row on the guide.

**Expected:**
- The form shows the day and the time you pressed, and the time is not editable.
- With no subject, the submit control stays unavailable — pressing it does nothing and no request is
  sent.
- On success the row shows your handle, the subject, the description, and "(you)".
- The form says, before you submit, that your handle and what you wrote go on a page anyone can read
  without an account.

Result: web ☐

---

### TR-4 — First come, first served

**Role:** two approved members · **Surfaces:** web
**Precondition:** Two browsers, two approved accounts, both on the guide with the same empty slot.

**Steps:**
1. Open the booking form for the same slot in both.
2. Submit both as close together as you can manage.

**Expected:**
- One succeeds.
- The other is refused with 409 and a sentence saying somebody just took that slot and to pick
  another.
- The guide shows exactly one booking on that time. **Never two rows on one slot** — if that happens,
  the partial unique index on `slot_start_utc WHERE status = 'booked'` is missing.

Result: web ☐

---

### TR-5 — Three slots in any 24 hours

**Role:** member, approved · **Surfaces:** web
**Precondition:** Signed in as an approved member holding no slots.

**Steps:**
1. Book three slots inside one day.
2. Try a fourth inside the same 24 hours.
3. Try one more than 24 hours after the earliest of the three.
4. Book three slots late one evening, then try one shortly after midnight.

**Expected:**
- The first three succeed.
- The fourth is refused with 409 and a sentence naming the ceiling and what to do about it — release
  one, or pick a time further out.
- The one past the 24-hour mark succeeds: it is a different stretch.
- The one after midnight is **refused**. The rule is a rolling 24 hours, not a calendar day, which is
  exactly the case that separates the two.

Result: web ☐

---

### TR-6 — Giving a slot back

**Role:** member, approved · **Surfaces:** web
**Precondition:** Signed in as a member holding a slot that has not started.

**Steps:**
1. Press "Give this slot back" and confirm.
2. Look at the row.
3. Sign in as a different approved member and try to release a slot that is not theirs, by calling
   `DELETE /api/ti-radio/slots/<id>` for it.
4. Try to release a slot that is already on air.

**Expected:**
- The row returns to open and is bookable by anybody.
- The other member gets 403 and a sentence saying it is somebody else's slot. **Not** a success, and
  not a 404 that hides which it was.
- A slot already on air is refused: people have turned up by then.

Result: web ☐

---

### TR-7 — An admin removes a slot

**Role:** admin · **Surfaces:** web
**Precondition:** Signed in as an admin, with somebody else's booked slot on the guide.

**Steps:**
1. Press Remove on that row and give a reason.
2. Look at the guide.
3. Read `ti_radio_admin_audit_trail`.

**Expected:**
- The row returns to open.
- A row in the audit trail with command `ti-radio.slot.remove`, the admin's id, the slot id, the
  host's id, and the reason. **A log line is not enough** — the row has to be in the table.
- The member's own booking wrote a row too, with command `ti-radio.slot.book`.

Result: web ☐

---

### TR-8 — What an unapproved member sees

**Role:** member, not approved · **Surfaces:** web
**Precondition:** Signed in with no Unlock approval.

**Steps:**
1. Open `/ti-radio`.
2. Try `POST /api/ti-radio/slots` directly with a valid empty slot.

**Expected:**
- The whole schedule renders, exactly as it does for anybody else.
- Empty rows read "Open — approved members can host" and are not buttons.
- One action is offered: "Finish verifying to host", pointing at Unlock.
- The route refuses the direct call on the Unlock tier.

Result: web ☐

---

### TR-9 — Times, timezones, and what is on air

**Role:** anybody · **Surfaces:** web
**Precondition:** A device whose timezone you can change.

**Steps:**
1. Read the guide, noting the zone named at the top.
2. Change the device timezone and reload.
3. Find the slot covering the current moment.

**Expected:**
- Every time moves with the zone, and the day headings regroup accordingly — a slot can move to the
  previous or next day, which is correct.
- The zone named at the top matches the device.
- The current slot is marked "On air" and is still on the page. A guide that drops the programme
  playing right now is the one thing a guide must not do.

Result: web ☐

---

### TR-10 — Times that are not on the guide

**Role:** member, approved · **Surfaces:** web
**Precondition:** Signed in as an approved member. Call the route directly.

**Steps:**
1. `POST /api/ti-radio/slots` with a start 20 minutes off a 90-minute boundary.
2. The same with a start in the past.
3. The same with a start a month out.
4. The same with a subject of one character.

**Expected:**
- The off-grid time is refused as not one of the times on the guide. **It is not rounded** — silently
  moving somebody's booking by an hour is worse than refusing it.
- The past time is refused with a sentence saying it has already started.
- The far-future time is refused with a sentence naming how far ahead the guide runs.
- The one-character subject is refused with a sentence naming the minimum length.

Result: web ☐

---

### TR-11 — Cross-origin and CSRF

**Role:** member, approved · **Surfaces:** web
**Precondition:** Signed in. Use a REST client.

**Steps:**
1. `POST /api/ti-radio/slots` with no `x-ctf-csrf` header.
2. The same with the header but an `Origin` from another site.
3. `GET /api/ti-radio/guide` from another origin.

**Expected:**
- Both writes are refused with 403 and a CSRF code.
- The read succeeds. It is public on purpose, and nothing in it is private.

Result: web ☐

---

### TR-12 — Deleting an account clears the schedule

**Role:** member, approved · **Surfaces:** web
**Precondition:** A throwaway approved account holding at least one booked slot.

**Steps:**
1. Delete the account from the account area.
2. Open `/ti-radio` signed out.
3. Read `ti_radio_admin_audit_trail`.

**Expected:**
- The slots are gone and those times read as open.
- The audit rows remain. They record that a command ran, not what was said, and an admin removal has
  to stay answerable for after the account is gone.

Result: web ☐

---

### TR-13 — Pressing a slot brings the form into view

**Role:** member, approved · **Surfaces:** web
**Precondition:** Signed in and approved, on a phone-width viewport. The guide scrolled far enough
that the top of the page is off screen.

**Steps:**
1. Scroll to a day near the end of the week and press an open slot.
2. Without scrolling, look at the screen.
3. Press Escape or the close control, then press a different open slot.
4. Repeat step 1 with the operating system set to reduce motion.
5. Repeat step 1 using only the keyboard: tab to an open slot and press Enter.

**Expected:**
- The booking form is on screen, roughly centered, without the tester scrolling. It renders above
  the days, so what moved is the page, not the form.
- The cursor is in the subject field, so typing starts the subject with no further press.
- The second press replaces the first form rather than opening a second one anywhere on the page.
- With reduce motion set, the page jumps to the form instead of gliding. It still arrives.
- On the keyboard path, focus lands in the subject field and the form is visible — a screen-reader
  user has no other signal that anything opened.

Result: web ☐
