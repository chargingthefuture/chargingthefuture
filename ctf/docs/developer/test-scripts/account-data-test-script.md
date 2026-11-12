# Account & Data — Manual Test Script

> **Android: not applicable.** This surface is web-only (rule 105); the installable web app (PWA)
> serves phones. Test on web only: the phone-width layout at desktop and ~390px.

> Walk these steps on a real device to confirm the Account & Data page (`/account/data`) works end
> to end. Source of truth: the account deletion registry
> (`ctf/packages/web/lib/account/deletion-registry.ts`) and the non-plugin feature inventory §1.2.

| | |
|---|---|
| **Surface** | `/account/data` (Your Data & Privacy), `/account` for AD-9 and AD-10, the 3.1 Today screen for AD-11, rooms in 3.1 for AD-12, + New for AD-13, Me for AD-14, Activity for AD-15, People for AD-16, Days won for AD-17, mute for AD-18, `/games` for AD-22 and 21 Questions for AD-23, 21 Questions matching for AD-24 |
| **Surface** | `/account/data` (Your Data & Privacy), `/account` for AD-9 and AD-10, the 3.1 Today screen for AD-11, rooms in 3.1 for AD-12, + New for AD-13, Me for AD-14, Activity for AD-15, People for AD-16, Days won for AD-17, mute for AD-18, `/games` for AD-22 and 21 Questions for AD-23 and web pages from Android for AD-24 and AD-25, Android parity for AD-26 |
| **Surface** | `/account/data` (Your Data & Privacy), `/account` for AD-9 and AD-10, the 3.1 Today screen for AD-11, rooms in 3.1 for AD-12, + New for AD-13, Me for AD-14, Activity for AD-15, People for AD-16, Days won for AD-17, mute for AD-18 and `/games` for AD-22 |
| **Visibility** | Any signed-in identity (including unlock-pending) |
| **Roles to test** | member |
| **Surfaces** | web (phone-width layout) |
| **Generated** | 2026-07-26 (hand-written on the JSON-export build, issue #1264) |

## How to run this

- Each case is **precondition → steps → expected**. Mark each box: ✅ pass · ❌ fail · ⛔ blocked.
- A ❌ becomes a row in the **Bug Reporting** plugin; link it in the notes line.

---

## AD-1 · Page loads and lists services from the registry

**Role:** member · **Precondition:** signed in; some plugin data exists (post in Commons, etc.).
**Steps:**
1. Open `/account/data`.
2. Read both lists: "Personal data" (deletable services) and "Always retained".
**Expected:** Every service and its one-line summary comes from the deletion registry (no
hardcoded copy). Retained entries (ServiceCredits, GDP, Weekly Performance…) show a lock and are
honestly framed as kept by design.
**Result:** web ☐ — notes:

## AD-2 · Export one service (JSON download)

**Role:** member · **Precondition:** the member has data in at least one service (e.g. Commons posts).
**Steps:**
1. On a service card, tap the Download (export) button beside Delete.
2. Open the downloaded file.
**Expected:** A file named `ctf-account-data-<slug>-<date>.json` downloads without leaving the
page. It is valid JSON with the envelope `exportVersion: 1`, `generatedAtIso`, `userId` (yours),
`scope: "service:<slug>"`, one `services[]` entry with `tables[]` (`table`, `userColumn`,
`rowCount`, `rows`), and `notes[]` stating the retained-data scope. Every row is the member's own
(the `userColumn` value is their user id); no other member's profile is joined in. A service with
no data still downloads an honest zero-table/zero-row file.
**Result:** web ☐ — notes:

## AD-2b · The Mood download holds the member's check-ins

**Role:** member · **Precondition:** the member has submitted at least one Mood check-in, with a note.
**Steps:**
1. On the Mood card, tap the Download (export) button.
2. Open the downloaded file.
**Expected:** The `mood_submissions` table lists every check-in the member made, with its
`mood_value`, `note` and `submitted_at`, and carries `readThrough: "pseudonym in
mood_client_identities"`. The rows hold an empty `user_id` and the member's pseudonym, which matches
the one row in `mood_client_identities`. No other member's check-in appears.
**Result:** web ☐ — notes:

## AD-3 · Export the entire account

**Role:** member
**Steps:**
1. At the top of the data view, tap **Download all my data (JSON)** (spinner shows while preparing).
2. Open the downloaded `ctf-account-data-full-account-<date>.json`.
**Expected:** One valid JSON document, `scope: "full-account"`, with a `services[]` entry for every
registry service that has user-scoped tables — including retained-list services that still hold the
member's own rows (e.g. Notifications). Money ledgers and audit trails are absent, and the `notes`
say so. Contents match what the page shows (a service you deleted in this session exports zero rows).
**Result:** web ☐ — notes:

## AD-4 · Export errors and rate limit

**Role:** member
**Steps:**
1. Trigger the full-account export 4+ times within a few minutes.
2. (If reachable) request `/api/account/services/not-a-service/export` directly.
**Expected:** Past the per-user limit (3 full exports / 10 min; 10 per-service / 10 min) the page
shows the inline "Too many exports" message (HTTP 429 with `Retry-After`) instead of replacing the
page with an error. An unknown slug returns 404 `ACCOUNT_UNKNOWN_SERVICE`. Signed out, the export
routes return the auth denial, never data.
**Result:** web ☐ — notes:

## AD-5 · Per-service delete (existing flow unchanged)

**Role:** member · **Precondition:** a service with data you are willing to delete.
**Steps:**
1. Tap Delete on a service card; read the confirm dialog; confirm.
2. Re-export the entire account.
**Expected:** The two-step confirm names the service and states permanence. After deletion the card
leaves the list and a fresh full export shows zero rows for that service. Full-account deletion
still requires typing `delete my account` (do not run this casually).
**Result:** web ☐ — notes:

## AD-5b · Clearing the blocked list keeps the safety reports you filed

**Role:** member (throwaway account) and admin · **Precondition:** the member has blocked someone
with the safety concern box ticked, so one safety report is open in `/admin/safety`.
**Steps:**
1. Open `/account/data` as the member. Find **Blocked members** under "Personal data" and **Safety
   reports you filed** under "Always retained".
2. Delete **Blocked members** and confirm.
3. As the admin, open `/admin/safety`.
4. Delete the member's entire account (throwaway only), then reload `/admin/safety`.
**Expected:** After step 2 the blocked list is empty, and the report is still open in
`/admin/safety`. **Safety reports you filed** shows a lock and has no Delete button. After step 4
the report the member filed is gone. Reports other members filed about them stay.
**Result:** web ☐ — notes:

## AD-6 · Deleting Commons data removes the posts, not just the author's name

**Role:** member (or admin on a throwaway account) · **Precondition:** the account has posted at
least two messages in the Commons, and one of them is still visible on the Commons chat.
**Steps:**
1. Open the Commons and note the exact text of your posts.
2. Go to Account & Data and delete the Commons service (or the entire account on a throwaway
   account).
3. Reload the Commons in a signed-in session and scroll to where the posts were.
4. Repeat the deletion once more, then reload again.
**Expected:** The post text is **gone** from the Commons — not still on screen under a generic
handle such as `user-hub-syst`, and not present with any other substituted author name. Official
announcements from the operator stay exactly as they were. The second deletion finds nothing left to
remove and changes nothing on screen. Replies and reactions that hung off the deleted posts are gone
with them.
**Result:** web ☐ — notes:

## AD-8 · A Stream cleanup that fails after a deletion is retried

**Role:** admin with database access, on a **throwaway account** · **Precondition:** the throwaway
account has posted in Chyme or the Commons, so it has a Stream user.
**Steps:**
1. Make Stream cleanups fail for a moment (for example, run the deletion in an environment whose
   Stream secret is wrong), then delete the throwaway account's data.
2. Read `account_external_cleanup_retries`.
3. Put the Stream secret back, set that row's `next_attempt_at` to now, and run the **Account — Retry
   Failed Stream Cleanups** workflow by hand.
4. Delete the Chyme data of a member who never opened Beacon.
**Expected:** The deletion itself succeeds at step 1. Step 2 shows one row per plugin whose cleanup
failed, with the account id, the slug and the reason, and nothing the member wrote. After step 3 the
row is gone, the workflow summary shows `cleared: 1` and no account id, and the member's messages
are gone from Stream. Step 4 leaves no row: a Stream user that never existed counts as already
deleted.
**Result:** web ☐ — notes:

## AD-7b · Full-account delete is refused without the typed phrase

**Role:** member (any account; nothing is deleted in this case)
**Steps:**
1. Signed in, send `DELETE /api/account/full-account` with header `x-ctf-csrf: 1` and no body.
2. Send it again with body `{"confirmPhrase":"delete my acount"}` (misspelled).
3. Open Account & Data and the full-account delete on web and on the Android app; check the delete
   button stays off until `delete my account` is typed.
**Expected:** Steps 1 and 2 return 400 with code `ACCOUNT_CONFIRM_PHRASE_REQUIRED` and a message
that nothing was deleted and that Android users should install the latest version first. The
account and its data are untouched, and the Chyme audit log records a deny with reason
`confirm_phrase_missing`. AD-7 still deletes the account when the phrase is typed, on web and on the
current Android build.
**Result:** web ☐ · android ☐ — notes:

## AD-7c · Clearing a demo test account with its sign-in is not counted as a member leaving

**Role:** admin / operator · **Precondition:** the Clerk webhook secret is set; a throwaway test account
with data in the demo schema. Added 2026-10-17 (#2893).
**Steps:**
1. Run the **Delete Account (manual)** workflow with `target: demo` and `also_delete_clerk` on, for that account.
2. Check production `account_deletion_events` and `chyme_deletion_events` for the same user id.
3. Open `/admin/adoption` and look at the deleted-accounts figure.
**Expected:** Step 2: the webhook wrote no production row in either table, and no ServiceCredits
reclaim was queued: a demo cleanup starts nothing in production. Step 3: the figure is unchanged. A
member deleting their own account is still deleted in production and counted.
**Result:** web ☐ — notes:

## AD-7 · Full-account delete removes the sign-in too

**Role:** member on a **throwaway account** · **Precondition:** a disposable account you are willing
to lose permanently — this cannot be undone. Note its email before you start.
**Steps:**
1. Sign in as the throwaway account, open Account & Data, choose the full-account delete, type
   `delete my account`, and confirm.
2. Read the "Deletion queued" screen, then press **Sign out** on it.
3. Try to sign in again with that account's email.
4. As an admin, open `/admin/unlock` and look at the "Sign-ups" panel.
**Expected:** Step 2: the confirmation says the personal data is being removed across all services
**and that the sign-in is removed with it**, and Sign out leaves the screen: the web goes to the
signed-out page, Android returns to the signed-out Apps screen. Step 3: signing in is no longer possible — the account is
gone from the auth provider, not merely emptied. Step 4: the account is not in the sign-up list at all
(it no longer exists), so it is not sitting in the "No Quora URL" tab as if it were someone who never
verified. If the auth provider is unreachable at the moment of deletion, the data deletion still
succeeds and the response carries `identityRemoved: false` with the reason; the "Deletion queued"
screen then says the sign-in could not be removed, gives that reason, and points at Report a bug,
instead of saying the sign-in is gone. The leftover account is cleared through the operator
`Delete Account (manual)` workflow.
**Result:** web ☐ · android ☐ — notes:

## AD-9 · Every member shows a generated picture, never an uploaded photo

**Role:** member · **Precondition:** signed in on an account that has a profile photo set in Clerk.
**Steps:**
1. Open `/`. Look at the profile card on the right rail (wide screen) and the account button on the
   phone-width top bar.
2. Open `/account`. Look at the Identity card's account button, then open it and choose Manage
   account.
3. Sign out, sign in as a second member, and repeat step 1.
**Expected:** Each place shows a small landscape or a cut-paper picture in earth colors, never the Clerk photo. The same
member gets the same pattern in every place and after a reload; the second member's differs. Clerk's
menu and Manage account show no photo and no upload or remove control. The Identity card reads
"Your name, username, and email".

## AD-10 · Switch to 3.1 and back to 3.0

**Role:** member · **Precondition:** signed in and approved, on 3.0.
**Steps:**
1. Open `/account` and find the Settings card. Tap **Switch to 3.1**.
2. On the home screen, tap each tab along the bottom: Today, People, the round + button, Activity, Me.
3. Press the browser's back button after moving between two tabs.
4. On Today, tap the word **Avenhood** in the title, then tap it again. On Me, tap the word **Aven** under your name.
5. Open `/apps/directory/invites` and one invite's page from it, then come back to `/`.
6. On the Me tab, tap the gear, then **Back to 3.0**.
**Expected:** Step 1 lands on the 3.1 home: forest green and gold, dark, the date above "Today in the
Avenhood", and the tab bar. Each tab shows its title; Me shows your picture, your name and the gear to Settings, and the
others say the screen is still being built. The address carries the tab (`/?tab=people`), and back
returns to the tab before. Tapping Avenhood opens and closes its definition under the title; tapping Aven on Me shows what an Aven is. The invite wall and the invite page open and work as before. Back to 3.0
returns to the 3.0 home. Signing in on another device or the Android app shows the same choice.
**Result:** web ☐ — notes:

## AD-11 · Today in 3.1

**Role:** approved member · **Precondition:** on 3.1 (AD-10 step 1); some activity exists (an open goal
on your board, a LightHouse listing, an announcement).
**Steps:**
1. Open `/`. Wait for the cards, then reload the page.
2. Tap a card's text, then tap it again. Tap one of its buttons.
3. Tap each chip: All, Asks, Offers, Stories, Matches.
4. On a card, open ••• and choose **Copy link**, then open ••• on another card and choose **Hide**.
5. Open the Main Room card's button.
6. If you have not answered the Quora account removals survey, find its card ("Lost a Quora account?
   Add it to the census"), tap **Add an account**, answer the survey, then reopen Today.
**Expected:** Step 1 shows the Main Room card (LIVE only while somebody is in it), with the TI Radio
talk that is on ("On now: …") or next ("Next: … · Today · 9:00 PM") when one is booked, and the day's cards,
newest first; after the reload the cards appear at once from the saved copy and then refresh. No
card shows a street address, a city on a request, or where a ride goes. Step 2 opens the card's full
text and closes it, and a check mark appears on it; no "N of N done" count appears anywhere. Step 3 shows only that kind. Step 4 copies the card's address, and the hidden card
is gone and stays gone after a reload. Step 5 opens the room inside 3.1 (AD-12). If a source fails, a
line under the chips names it and the rest of the cards still show. A member who is not a Weaver of
the Commons never sees a Weavers card or any line naming it. Step 6: the survey card is gone once the survey is answered.
**Result:** web ☐ — notes:

## AD-12 · Rooms in 3.1

**Role:** approved member; a second account that is a Weaver of the Commons · **Precondition:** on 3.1.
**Steps:**
1. On Today, tap the Main Room card's button while nobody is in the room.
2. Tap **Listen in**. Then tap the Today, People and Me tabs in turn.
3. Tap the title on the bar above the tab bar. Then tap **Back to Today** (the round back button) at the top.
4. On the bar, tap **Leave quietly** (the round close button).
5. Sign in as the Weaver and open the Weavers of the Commons card on Today.
**Expected:** Step 1 opens the room inside the app (no page change): "Main Room", "Open to everyone",
the talk line when one is booked, and "Quiet right now" with the readings player. Step 2 joins muted
and shows "Guests may be listening"; the bar at the bottom reads Leave quietly, with Bring someone in
(which shares the signed-out Today), Raise hand and Unmute. Moving between tabs keeps the audio
going, and a bar above the tab bar shows the room's title, who is speaking and "you are listening". Step 3 opens the
room again, then puts it back in the bar. Step 4 leaves the call and the bar goes away. Step 5 shows
the card only to the Weaver; the room reads "Private, badge holders only", has no guest notice and
no Bring someone in. The 3.0 Chyme page still reads Join Room, Leave and Back Channel.
**Result:** web ☐ — notes:

## AD-13 · + New: Talk, Ask, Offer and Story

**Role:** approved member; an account not yet approved · **Precondition:** on 3.1.
**Steps:**
1. Open the + tab. Tap Talk. Pick a day in the strip, tap an open time, type a topic and tap **Book
   this slot**.
2. Open the TI Radio guide and Today's Main Room card.
3. Try to book a second slot the same day, then sign in as the account not yet approved, open + and
   tap Talk.
**Expected:** Step 1 shows "Host a talk in the Main Room" with "Times are yours, <your zone>.", the
seven days from today, and every time that day: open ones dashed with "Take this slot", booked ones
with their title and "Hosted by <host>". The time tapped turns yellow as "Your talk · Picked" and its
times appear beside "What is it about?". Booking confirms "Booked for <day>. It shows on Today and in
the TI Radio schedule." and the time shows as booked. Room rule shows the rule in place. Step 2 shows
the booking on the guide and, when it is the next talk, on the Main Room card. Step 3 shows the
route's own reason when a limit is hit; the account not yet approved sees "Booking a talk opens once
you are verified", Finish Unlock, and a Next talk box with its host, date and time, and Add to
calendar.
4. Tap Ask. Type "A ride to". Tap "A ride to the pharmacy or grocery store", leave Details empty and
   tap **Post**.
5. Type another ask, tap **+ Break it into small tasks**, fill two tasks and tap **Post**.
6. Tap each Offer choice and the Story link; tap "A question about the app? Ask the architect"; tap
   Close.
**Expected (4 to 6):** The sheet reads "Post something" and "It goes into everyone's Today." with
Community guidelines at the top. Suggestions list only asks that contain every word typed, with the
typed words in bold; with nothing typed, one from each group. Details is marked (optional) and the
hint "Everyone can read this. Keep times and places for the private conversation." sits under it.
Step 4 says "Posted. It shows on Today, and answers come to Activity." and the ask appears on Today
and in SocketRelay with the tag "Getting around" and no city. Step 5 sets Details aside, says "Posted
to your goal board. It shows on Today." and the goal and both tasks appear on the PeerProgramming
board (a member with no cohort sees the board's own reason). A place to stay opens LightHouse, Hours
Mutual Time, A ride TrustTransport, A skill Foundation, and the Story link the Knowledge Library. The
architect line opens Ask the architect with the member's questions. Close returns to Today.
**Result:** web ☐ — notes:

## AD-14 · Me, Settings and Theme in 3.1

**Role:** approved member; an admin; a Weavers of the Commons badge holder · **Precondition:** on 3.1. **Surfaces:** web, android
**Steps:**
1. Open Me.
2. Tap **Add a line about you**, write a line under "I can help with" and "Ask me about", leave "I need" empty, and tap **Save**. Reload.
3. Tap Send, go back, tap Receive, then History, go back.
4. Tap **Read**, go back, tap **Hidden**, go back.
5. Tap each of the six Tools tiles in turn, coming back each time.
6. Tap the gear. Tap **Theme**, pick Light, then Coral. Reload. Sign in on the other device.
7. Back in Settings, tap Text size until it says Larger, then Higher contrast and Easier-to-read font. Reload. Then put them back.
8. Tap Muted people and words, then Blocked people, then Quora census, coming back each time.
9. Tap Ask the architect; go back to Me → Settings and tap Report a bug, then close it.
10. Tap Guide and community rules, Terms and privacy, Wallpapers, Get the Android app, Delete data from one part of the app and Delete your account in turn.
11. Sign in as the admin and as the badge holder and open Me.
**Expected:** Step 1 shows the picture with a dark ring, your name (no @, the same on web and Android), "Aven since <month year>", the gear, ServiceCredits with the balance in credits and "credits, not money" under it (never money words), round Send, Receive and History buttons with icons in that order, Read and Hidden, Tools with A place to stay, Trade hours, Learn a skill, Our numbers, Bring your writing and Log what happened, and the emoji rain switch. Step 2 shows the two written lines under their labels and no "I need"; they stay after the reload and on the other device. Step 3 opens ServiceCredits on its Send tab, copies @handle and says so, and opens the wallet tab. Step 4 lists the cards you marked done (Read) or Not for me (Hidden) that are still around, each opening where it lives, or "Nothing here yet."; the web address carries `view=read` and the back button returns to Me. Step 5 opens LightHouse, Mutual Time, SkillUp, Workforce, the Knowledge Library and ClickLog (in the browser on Android). Step 6 opens Theme with Back to Settings, Dark and Light, then Burgundy (Default · The landing page), Forest and gold (One Percent), Coral (The blog), Teal and purple (The first wallpaper), "The same colors as the wallpapers" and Get; the app recolors at once and keeps Coral light after the reload and on the other device. Step 7 makes the screen larger (the tab bar stays its size), the gray text dark or light like the rest and the borders stronger, and the text Atkinson Hyperlegible, all kept after the reload. Step 8 opens the Muted card in place with its count on the row, the blocked list with its count, and the survey; the census row says Added once the survey is answered. Step 9 opens + New on Ask the architect, then the bug report form. Step 10 opens each place; Wallpapers and the Android app open GitHub releases filtered to each, and both delete rows open Account and data. Step 11 shows System Architect for the admin (tapping it opens the admin screens) and Weavers of the Commons for the badge holder; a member who is neither sees no badge.
**Result:** web ☐ android ☐ — notes:

## AD-14b · Notifications and quiet hours in 3.1 Settings

**Role:** two approved members · **Precondition:** on 3.1 in a browser that allows notifications. **Surfaces:** web, android (Android saves the same rows and quiet hours; pings for these go to browsers only)
**Steps:**
1. As the first member, open Me → Settings and turn **Replies and talk requests** On; allow notifications when asked.
2. As the second member, reply to the first member's Commons message.
3. As the first member, tap **Quiet hours**, set From to a minute ago and To to an hour from now, and save. Repeat step 2.
4. Tap Quiet hours and **Turn quiet hours off**. Turn the row Off and repeat step 2.
**Expected:** Step 1 shows On and saves; on another device the row shows On too. Step 2 pings the first member's browser. Step 3 shows the hours on the row and sends no ping, while the reply still appears in Activity. Step 4 shows Off on Quiet hours, and with the row Off no ping comes; the reply still appears in Activity. A member still on 3.0 is pinged by the three categories in the 3.0 panel instead.
**Result:** web ☐ android ☐ — notes:

## AD-15 · Activity in 3.1

**Role:** approved member; a second member · **Precondition:** on 3.1.
**Steps:**
1. As the second member, reply to one of the first member's Commons posts, send them 1 ServiceCredit,
   invite them to a Recurring Activity, and on a Today card the first member answered, ask them to
   talk just you two.
2. As the first member, open Activity. Tap **Agree** on the Just us two request and **Confirm** on the
   invite.
3. Open the reply. Return to Activity, then leave it and open it again.
**Expected:** Step 2 shows the request (with the second member's picture, Agree and Not now) and the
invite (Confirm and That's not right) at the top, then the reply and the credits under "Today", each
with an icon and its full date and time in the reader's own timezone, and the line "That is
everything. Notifications are quiet unless you turn them up in Me." at the end. No unread badge
anywhere. Agree shows "Agreed. Open the card in Today to talk just you two." and the card's Just us
two conversation is open; Confirm shows "Confirmed." and the activity is confirmed in Recurring
Activity. Step 3 opens the reply; on the second visit the answered request and invite sit in Today as
plain rows. Not now on a request moves it out of the top straight away. On a day-14 notice, tap "Keep it up for 14 more days" and reload: the notice is a plain row with "Kept up on Today for 14 more days." and no button; closing an ask from its card does the same with "Closed. It has left Today." A notice from an earlier
day is under "Earlier". With nothing recorded, Activity reads "Nothing yet. Replies, credits sent to
you and confirmations show here."
**Result:** web ☐ android ☐ — notes:

## AD-16 · People in 3.1

**Role:** approved member; a signed-in member not yet approved · **Precondition:** on 3.1; one
claimed profile whose owner offers a skill in Foundation; a profile with a state and country and a job
title in the Health sector.
**Steps:**
1. Open People. Page forward and back, then reload on page 2.
2. Tap **Offering now**, then **Care**, then **All**. Search a skill name.
3. On a person who offers a skill, tap **Request a quote**; on another, tap the card.
4. As the member not yet approved, open People and tap **Back to Today**; open People again and tap
   **Finish Unlock**.
**Expected:** Step 1 shows "People" with "N listed" beside it, a search reading "A skill, like
plumbing or tax forms", the chips All, Offering now, Trades, Care, Paperwork and Tech, and 20 people a
page with "1–20 of N", people who offer something first; the reload stays on page 2. Each card shows
the name with Member (claimed) or Listed, then job title · place such as "Georgia, US" (never a city),
then "Offering" with offered skills filled in the Offer color and "Listed" with listed skills
outlined; a skill shows once. Step 2 keeps only people offering something, then people in Care
(Health, Education, Emergency & Reserve Roles), then people in Trades, which includes a person whose
sector is Creative & Media, then everyone; the search narrows to people with
that skill in their name, headline, job title or listing. Step 3 opens the Foundation provider page and
the Directory profile. Request a quote never shows for someone offering nothing, and there is no
Profile button. Step 4 shows ten faded faces, the number listed with "people listed, with what they
can do", why names wait for one check, **Finish Unlock** (opens Unlock) and "Open to you now" with
**Back to Today** (opens Today), and no name, skill or place of anybody.
Opening People never shows "Could not read People" while the app and its database are up.
**Result:** web ☐ — notes:

## AD-17 · Days won, and the measures on Adoption

**Role:** two approved members; an admin · **Precondition:** on 3.1.
**Steps:**
1. Open Today and note "Days the Avenhood has won".
2. Both members join the Main Room and stay 20 minutes. Then reload Today.
3. As the admin, open `/admin/adoption` and read "Days won and retention". Tap **Copy as text**.
**Expected:** Step 1 shows the total large, "Our progress this week: N days won." and "How it's
counted", which opens "Time members spent together in rooms and calls, or helping with each
other's tasks. That is less time on Specterati schemes, and more time for all of us reaching our own
definition of happiness." under it, then "Why we count it", which opens the blog post "Why we count days
won"; signed out, the same link sits under the hero line. Step 2 raises the total by about 40 minutes
÷ 480 (0.1 after rounding). Step 3 shows Days won, Retained (with the share and the 20% target),
Came back, Every day and time to unlock as counts only, with no member named; Copy as text pastes the
same lines. A failed read shows "Could not read the measures:" with the reason.
**Result:** web ☐ — notes:

## AD-17b · The four colors in light and dark

**Role:** any member · **Precondition:** on 3.1. **Surfaces:** web, android
**Steps:**
1. Open Me → Settings → Theme and choose each color, first with Dark, then with Light.
**Expected:** Every color shows its own color on the buttons, the selected chips and the + button in
both modes: Coral is coral with dark text in light and dark alike, never near-black.
Signed out, the "Skills Economy" name at the top of Today is easy to read in every color; in Coral
light it is dark, not coral.
## AD-17a · The week strip and the room cards on Today

**Role:** two approved members, one of them a Weavers of the Commons badge holder · **Precondition:**
on 3.1; a talk is booked in the Main Room for later this week. **Surfaces:** web, android
**Steps:**
1. Open Today and look under Days won.
2. Tap the day of the booked talk, then a day with nothing booked, then a day already gone.
3. With one member speaking in the Main Room and the other listening, open Today as the badge holder.
4. Tap **Bring someone in**.
5. Tap **Listen in**, then go back to Today and tap **Open** on the Weavers row.
**Expected:** Step 1 shows the week from Monday to Sunday with today filled in, and a dot under each
day with a talk booked. Step 2 shows that day's date with the talk's title, host and times in the
reader's own timezone; a day with nothing booked says "Nothing booked in the Main Room that day."; a
day already gone cannot be chosen. Step 3 shows the Main Room card with LIVE, "Main Room · open to
everyone", the talk's title, "Hosted by <host> · <start> to <end> <zone>", the faces of the people
in the room and "1 speaking, 1 listening" (guests count as listening), and the Weavers row with a
lock, "Private, badge holders only · quiet now" or "· N here", and Open. A member who is not a badge
holder sees no Weavers row. Signed out, the Main Room card shows no faces. Step 4 opens the phone's
share sheet (or copies the link on a computer, saying "Link copied") with "Listen in to the Main Room
on Skills Economy. No account needed." and the signed-out Today address. Step 5 opens each room
inside the app.
**Result:** web ☐ android ☐ — notes:

## AD-17c · Burgundy by default, and signed out

**Role:** a visitor, then a member · **Surfaces:** web, android
**Steps:**
1. On a phone that has never opened the app, open the app signed out.
2. Sign in, open Me → Settings → Theme and pick Coral. Sign out again.
3. Set the phone to light, then to dark, while signed out.
**Expected:** Step 1 shows signed-out Today in burgundy, light or dark as the phone is set, with the
hero line ending "That is less time on Specterati schemes, and more time for all of us reaching our
own definition of happiness. Free. Exit their economy, exit the psyop." Step 2 keeps Coral while
signed in; signing out uses **Sign out** at the end of Settings (Me's gear), which asks "Sign out of this
device?" first and lands on signed-out Today, burgundy again. Step 3 switches signed-out Today and
the room page between burgundy light and burgundy dark. A member who never picked a color sees
burgundy, dark, once signed in.
**Result:** web ☐ android ☐ — notes:

## AD-18 · Personal mute

**Role:** two approved members, A and B · **Precondition:** on 3.1; B has an ask on Today.
**Steps:**
1. As A, open B's card ••• menu and tap **Mute @B**.
2. Open Me → Muted. Add the words "blankets". Then tap **Unmute** on B.
3. As B, look for any sign of the mute.
**Expected:** Step 1 says "@B is muted. Their cards leave Today." and B's cards leave Today (after a
reload too). Step 2 lists @B; a card with "blankets" in it leaves Today; after Unmute, B's cards
return. Step 3: B sees nothing; B can still see A's cards, and nothing else between them changes (a
mute is not a block).
**Result:** web ☐ — notes:

## AD-19 · Today for a visitor who is not signed in

**Role:** signed out; then a member · **Surfaces:** web, android · **Precondition:** an open ride
request and a Skill Up cohort exist; once with the Main Room live, once with it quiet.
**Steps:**
1. Signed out, open `/today` (Android: open the app signed out).
2. With the room live, tap **Listen as a guest** on the room card.
3. With the room quiet, look at the room card.
4. Tap **Sign up to answer** on an ask, then **Sign in** at the top.
5. Signed in, open `/today`.
**Expected:** Step 1 matches the approved "Today, signed out" board: "Skills Economy" with Sign in at
the top; Days won with "Skills Economy is where the Avenhood meets…" and Sign up; the room card;
"Today's cards" with "Read only"; asks and offers from "A member" with Sign up to answer, stories with
Read it; a dashed People card that says it opens once a member is reviewed; and a bar along the
bottom, "Free. Use one part, ignore the rest." with Sign up. No card shows a name and there is no
card menu. Step 2 starts listening right there on the card, with no account. Step 3 says "The audio
room is quiet now" on one line, naming the room as audio so it never reads as the app being quiet, offers the readings, and shows the next room with Add to calendar. Step 4 opens sign-up,
then sign-in. Step 5 lands on the home page.
**Result:** web ☐ android ☐ — notes:

## AD-20 · 3.1 is the default (launch, 2026-10-28)
**Role:** a member who never switched, a member on 3.0, a signed-out visitor · **Surfaces:** web, android
**Steps:**
1. As a member who never opened Settings, open the app.
2. As a member who was on 3.0 before the launch, open the app, then go back to 3.0 in Settings and reload.
3. Signed out, open `/`.
**Expected:** Step 1 shows the 3.1 frame. Step 2 shows 3.1 first, and 3.0 after going back, which stays.
Step 3 lands on `/today`, Today as anybody can read it, with Sign in.
**Result:** web ☐ android ☐ — notes:

## AD-21 · Done on the timeline dot, and undone
**Role:** a member on 3.1 · **Surfaces:** web, android
**Steps:**
1. On Today, tap a card's text, then one of its buttons and come back.
2. Tap the colored dot beside the card.
3. Tap the dot again.
**Expected:** Step 1 opens the card and the item without marking it done. Step 2 puts a check in the
dot and the done count goes up by one. Step 3 removes the check and the count goes back down.
**Result:** web ☐ android ☐ — notes:

## AD-22 · Stories and the puzzle of the day
**Role:** a visitor who is not signed in, then a member on 3.1 · **Surfaces:** web, android (signed in)
**Steps:**
1. Open Today and pick the Stories filter.
2. Tap Play on the "Puzzle of the day" card.
3. Play it: pick the word for the meaning, swap strips until the picture is back in order, or type words one
   letter apart until the last word is reached (try Hint and Undo once).
4. Tap Copy to share and paste the line somewhere.
5. Close the page and open `/games` again; then open it on the next day.
**Expected:** Step 1 shows five Story cards marked "from the blog" or "from Quora", each with This helped
me, Save for later and Hide (tapping the title opens the sheet with Open in the blog), and the Puzzle of the day card with its number. Nothing in the puzzle comes from a blog post.
Step 3 never ends in failure: a wrong word is marked and another can be picked, and the ladder
accepts any number of steps. Step 4's line gives the puzzle number and how it went, never the answer.
Step 5 shows Done with the same result the same day, and the next kind of puzzle the next day (word,
picture, ladder in turn). No sign-in is asked for. On Android, step 2 opens the puzzle in the app.
**Result:** web ☐ android ☐ — notes:

## AD-23 · 21 Questions
**Role:** two approved members, A and B, on 3.1 · **Surfaces:** web, android
**Steps:**
1. As A, open Today and pick the Matches filter. Tap an answer on the 21 Questions card.
2. Keep answering until the card is gone or says catching up, then do the same as B with the same answers on three questions.
3. As A, read Today again and tap Talk here on the Match card. Send a message.
4. As B, open Activity, then the Match card on Today.
5. As B, block A, then read Today again.
**Expected:** Step 1 says Saved; the card stays with its dot checked, the buttons gone and "You picked:" with the answer, the dot cannot be unchecked, and a question missed on an earlier day shows as its own catching-up card; no question asks about home, family or
where somebody lives. Step 3 shows "You and @B answered N of M the same" and the message in the
card. Step 4 shows the new message in Activity and in the card, marked "1 new message" until opened.
The Wanted and mission cards are under Asks, not Matches. Step 5 removes the Match card for both.

## AD-24 · 21 Questions matching on and off
**Role:** two approved members, A and B, on 3.1, who match (AD-23), and C, approved, with no answers · **Surfaces:** web, android
**Steps:**
1. As C, open Today, pick the Matches filter, then open Me.
2. As A, pick the Matches filter on Today and read the 21 Questions card.
3. As A, turn off Match me with members who answer like me under Matches.
4. As B, read Today again under Matches.
5. As A, answer another question, then open Me.
6. As A, turn the toggle back on from Me, then read Today again. As B, read Today again.
**Expected:** Step 1 shows no matching toggle in either place. Step 2's card explains that answering is
the opt-in, that reaching out and replying are optional, and how to stop being matched, then the
answered count; the toggle is on, with the line about what Off does under it. Step 3 removes A's Match
cards, and the card says matching is off and how to turn it back on. Step 4 shows no Match card for A,
and a message to A is refused. Step 5 leaves the toggle off on Me and the card still says matching is
off. Step 6 brings the Match cards back for both, with the same answers.
Step 7 (owner, Neon SQL Editor): run `ctf/scripts/sql/twenty_one_questions_audit.sql` query 2 with A's
account id. It lists A's answers, then matching_off from step 3 and matching_on from step 6, newest first.
As A, tapping a different answer on a question already answered adds an answer_refused row and keeps the
first answer.
## AD-24 · Web pages open over the Android app
**Role:** a member on 3.1 · **Surfaces:** android
**Steps:**
1. On Today, tap a button on a card from a plugin the app does not carry (an ask, a story, a What Works card).
2. Close the panel with its X.
3. From Unlock, open the Commons link; from Me, open the survey.
**Expected:** Step 1 opens the page in a panel over the app, with the page title in its bar, not in a
separate browser app. Step 2 returns to Today where it was. Step 3 opens each page the same way.
**Result:** web ☐ android ☐ — notes:

## AD-25 · Arriving signed in from Android
**Role:** an approved member signed in on Android, signed out in the phone's Chrome · **Surfaces:** android
**Steps:**
1. On Today, tap a card button that opens a web page (an ask, a What Works card).
2. Close the panel, wait two minutes, and tap a different one.
3. Sign out on Android, sign in as a member who is not yet approved, and repeat step 1.
**Expected:** Steps 1 and 2 show "Signing you in…" for a moment, then the page, signed in as the
same member, with no sign-in screen. The address bar never shows a ticket. Step 3 opens the page
without signing in, and the page asks for sign-in itself.
**Result:** web ☐ android ☐ — notes:

## AD-26 · Android 3.1 matches the web
**Role:** a visitor signed out, then a member on 3.1 · **Surfaces:** android
**Steps:**
1. Open the app signed out.
2. Sign in; on Today, find a room card with a talk coming up and tap Add to calendar.
3. Open the room; read its header.
4. Open the puzzle of the day, finish it, tap Back to Today.
5. Open + New → Talk; open Me; open People and tap Next.
**Expected:** Step 1 shows "Today in the Avenhood" with a Sign in button, the cards with no names,
and a Main Room card with Listen in, not the 3.0 apps list. Step 2 opens the share sheet with a
calendar file. Step 3 shows the room rule under the talk. Step 4 shows the puzzle full screen in
the 3.1 colors with Back to Today at the top and beside Copy to share, and returns to Today. Step 5:
Talk lists every open time under "Choose a time"; Me has no title; People's next page starts at the
top. The Unlock banner, when shown, sits above the Today header. 21 Questions cards have no Open
button.
**Result:** web ☐ android ☐ — notes:

## AD-27 · A Today card opened in place, answers and Just us two
**Role:** two approved members, A and B, on 3.1; C, signed in and not yet approved in Unlock, inside their first 14 days · **Surfaces:** web, android
**Steps:**
1. As A, post an ask on the PeerProgramming goal board, then open Today and tap the ask's title.
2. As B, open Today, tap I can help on A's ask.
3. As B, write "I can drive Thursday" in the composer and send it.
4. As A, open the ask. Tap Talk here beside B.
5. As B, open the ask.
6. As B, tap Agree. Switch to Just us two and send "Where should I pick you up?"
7. As A, open the ask, switch to Just us two, and read. Check Activity.
8. As B, tap ••• in the sheet and Report, then Report this message under one of A's messages. As B, tap Share.
9. As A, block B from B's profile, then open the ask as both.
10. As C, open Today and tap the title of any ask, offer or story. Tap a 21 Questions card's text.
**Expected:** Step 1 opens a sheet over Today (no new page) with the author, "Ask · <date and time>",
Share, •••, Close, the title, the body, "Open in PeerProgramming", "Conversation" with Public and Just
us two, "Write in this card" and "Everyone can read this. Just us two opens once you both agree." Step
2 opens the sheet with "1 person answered" and "You can help"; tapping I can help again adds nothing.
Step 3 shows the message on the right in the button color. Step 4 shows "1 person answered", B can
help, and B's message on the left; after Talk here, A sees "Waiting for B to agree" and B has an
Activity notice. Step 5 shows "A asked to talk just you two · Agree". Step 6 opens Just us two for
both, and the message is on the right for B with "Only you and A can read this." Step 7 shows the
message to A only (a third member opening the ask sees no Just us two messages), and A has an
Activity notice. Step 8 shows "Reported. An admin reads every report." twice, and the admin reports
screen lists two reports naming the card id, the second with the message text; Share opens the
share sheet (web without one: Link copied). Step 9 hides each from the other's answers and
messages, and a Just us two message or Talk here between them is refused with "one of you has
blocked the other". Step 10, with C inside their first 14 days, lets C answer, write in
public, ask for Just us two and report, the same as an approved member; the 21 Questions card still
expands in place. With C past day 14 and no address sent, the sheet reads normally and any write turns
it read-only with "Writing in a card is paused until Unlock is done. Reading stays open, and your
account is never removed for this." With `CARDS_OPEN_BEFORE_UNLOCK` set to false, C sees "Writing in a
card opens once Unlock is done." instead, from the first write.
**Result:** web ☐ android ☐ — notes:

## AD-28 · Done and Not for me are counted with no names
**Role:** an approved member A on 3.1; C, signed in and not yet approved in Unlock; an admin · **Surfaces:** web, android (the admin step is web only)
**Steps:**
1. As A, open Today and tap ••• on an ask card.
2. As A, tap Not for me.
3. As A, tap the timeline dot on a story card, then tap it again, then once more.
4. As A, turn off the network, tap the dot on another card, and tap Not for me on a third.
5. As C, mark one card done.
6. As the admin, open Adoption (`/admin/adoption`) and find "What members finish and pass on". Tap Copy as text and paste it into a note.
7. As the admin, read the newest `today_card_feedback_counts` rows in the Neon dashboard.
**Expected:** Step 1 shows Copy link, Not for me and, on a card with an author, Mute and Report; no
menu says Hide, and no new button is on the card face. Step 2 takes the card off Today on this
device. Step 3 marks the story done, not done, then done, and counts two Done marks (only the change
to done counts). Step 4 changes both cards on screen exactly as with the network on, and shows no
error; nothing is counted for them. Step 5 is counted the same as A's. Step 6 shows a row per source
and kind, for example "socket-relay · ask" with Not for me 1 and Not for me share 100%, most marks
first, and the pasted text has one line per row and says counts only, nobody named. Step 7 shows
rows with a day, source, kind, signal and count, and no column naming who tapped.

## AD-30 · How long cards stay on Today
**Role:** member A (posting) and member B (reading) on 3.1 · **Surfaces:** web, android
**Steps:**
1. As A, open + New → Ask. Fill in what you need, choose "By when?" → A date, pick a date three weeks
   ahead, and post. Post a second ask with No deadline.
2. As B, open Today. As A, open Today and tap the title of each of your asks.
3. As A, on the no-deadline ask, tap Keep it up for 14 more days.
4. As A, on the dated ask, tap Closed, not done. Read Today again, then open SocketRelay.
5. On a test database, set the no-deadline ask's `created_at` 13½ days back and remove its
   `today_card_windows` row, then as A read Today and open Activity. Tap Keep it up for 14 more days there.
6. Set an announcement or a Directory invitation 8 days back and read Today.
7. As B, mark a card done with its dot. Change the device date to tomorrow and read Today, on this
   device and on another one signed in as B.
8. Read Today with an open Skill Up cohort that has a seat. Close its registration as an admin and read
   Today again.
**Expected:** Step 1: the ask form shows "By when?" with Today, This week, A date and No deadline (No
deadline picked), and A date opens a date picker. Step 2: B sees both asks; A sees both with "You posted
this · On Today until <date>": the dated one until its date, the other 14 days from posting. The dated
one has Done and Closed, not done only; the other also has Keep it up for 14 more days. Step 3 reads
"Kept up on Today for 14 more days." and the date moves to 14 days from now. Step 4: the ask leaves A's
and B's Today and shows as canceled in SocketRelay; the closing outcome is `not_done` in
`today_card_windows`. Step 5: Activity has "Still need this? Keep it up for 14 more days: <title>" under
Needs your answer, once only, and the tap keeps the ask up 14 days from then. Step 6: the story is gone
from Today and still in its own place. Step 7: the card stays on Today the day it was marked, shown done on both
devices, and is gone the next day on both; a 21 Questions card marked done by its answer stays. Step 8: the cohort card reads "Learn
a skill · learners wanted" (or "a trainer and learners wanted" while no trainer owns it) and leaves Today
once registration closes, with no renew offered.
**Result:** web ☐ android ☐ — notes:

## AD-31 · Card windows go with the account
**Role:** member A from AD-30 · **Surfaces:** web
**Steps:**
1. As A, delete the account (or only Card conversations on Today) from the account area.
**Expected:** Every `today_card_windows` row with A as `owner_user_id` is gone; the listing names "The
deadlines, renewals and closing outcomes of your own asks and offers on Today."
**Result:** web ☐ android ☐ — notes:

## AD-32 · Done and Not for me are stored on the account
**Role:** member A signed in on web and on Android; a visitor who is not signed in · **Surfaces:** web, android
**Steps:**
1. As A on the web, mark a story done with its dot and pick Not for me on another card.
2. Open Today as A on Android.
3. On Android, tap the dot on the done story again.
4. On a phone or browser that still holds marks from before this change, sign in as A and open Today.
5. As A, delete the account (or only Card conversations on Today).
6. As the visitor, open signed-out Today.
**Expected:** Step 2 shows the story done and the other card gone, as on the web. Step 3 takes Done away
on both. Step 4 sends the old marks once (a card the account already marked keeps its mark) and the old
copy is removed from the device; Today then reads the same as on the other device. Step 5 removes every
`today_card_marks` row for A. Step 6 shows no marks and offers none. The anonymous Done and Not for me
totals (AD-28) still count each mark.
**Result:** web ☐ android ☐ — notes:

## AD-33 · The day-14 notice without opening the app, and closing after day 14
**Role:** member A, signed in, not approved in Unlock and past day 14 · **Surfaces:** web, android (step 1 is a GitHub Actions run)
**Steps:**
1. On a test database, set one of A's open asks (no deadline) to 13½ days old. Without A opening the app, run "Today — Day-14 Notices" from Actions twice.
2. As A, open Activity, then open Today and tap the ask's title.
3. Tap Keep it up for 14 more days, then Closed, not done on another of A's asks.
**Expected:** Step 1: the run summary shows only counts ("checked N … M were due"), no names; the second run sends nothing new. Step 2: Activity has exactly one "Still need this? Keep it up for 14 more days: <title>". Step 3: both work for A although their posting is paused; another member calling either route on A's card is refused with not_yours, and an account restricted from contact is refused.
**Result:** web ☐ android ☐ — notes:

## AD-34 · The rest of the Today board: Avens here, Save, Mood faces, the closing line, the broadcast
**Role:** members A and B, signed in on web and Android; an admin who can go live in Beacon · **Surfaces:** web, android
**Steps:**
1. As A, open Today. Then as B on another device, open Today and wait a minute; open Today as A again.
2. As A, tap Save for later on a story, then open Me.
3. On Android as A, open Me, then tap the saved story's title, then Remove.
4. As A, tap This helped me on a blog story, then Hide on another story.
5. As A, on the Mood card, tap Good.
6. Scroll to the end of Today on a day with asks, and on a day with none.
7. As the admin, go live in Beacon; as A, open Today.
8. As A, delete the account (or only Card conversations on Today).
**Expected:** Step 1: the pill beside the title reads "1 Aven here", then "2 Avens here"; no name appears anywhere. Step 2: the bookmark fills, and Me → Saved lists the story with "Story" and its title. Step 3: the same list on Android; the title opens the story; Remove takes it off and the bookmark on Today is empty on the next read. Step 4: the card's sheet opens with "says this helped" recorded; Hide takes the other story off Today for good. Step 5: the card says "Checked in: Good. The next check-in opens in a week." and the check-in shows in Mood; the card is gone on the next read. Step 6: "You're caught up." or "That is today.", then "5 more stories open at your midnight." No ask card shows a credit line. Step 7: the broadcast card shows LIVE, the title, "<host> · started at <time>", Watch and Chat; the Main Room reads "Quiet during the broadcast" with Open unless somebody is in it. Step 8 removes A's `today_card_saves` rows and `member_presence` row.
**Result:** web ☐ android ☐ — notes:

## AD-35 · What Session Replay and error reports send
**Role:** a member, signed in on web and Android, on a build with a Sentry DSN set; an admin with access to the Sentry project · **Surfaces:** web, android
**Steps:**
1. On web, open a Directory profile (`/apps/directory/profile/<id>`), open a Today card, and type a sentence into a card's answer box. On Android, open a Today card and type a sentence the same way.
2. Cause an error on each (for example, open an address that fails, or use a test build that throws), so the session's replay is kept.
3. In Sentry, open that replay and the error event for each.
**Expected:** Step 3: the replay's page list, its navigation and network rows and its breadcrumbs show addresses with `:id` in place of every profile id, card id, account id, match code and long number, and `:value` in place of every query value, with the keys kept (for example `/apps/directory/profile/:id`). The typed sentence appears nowhere: no input or log breadcrumb carries text, and no request or response body is attached. The error event carries no cookie, no Authorization header and no user, its request address is scrubbed the same way, and an email address or phone number in its message shows as `:email` or `:phone`. On-screen text and pictures stay masked as before.
## AD-36 · Emoji rain when Days won goes up (added 2026-11-11)
**Role:** an approved member on 3.1; an admin who can see the Days won total move (or a day with an exchange recorded) · **Surfaces:** web, android
**Steps:**
1. With Emoji rain off (Me → Settings → Look and reading), open Today. Note the Days won total.
2. Wait until Days won goes up (an exchange recorded today), then open Today again.
3. Turn Emoji rain on. Open Today; wait until Days won goes up again and open Today.
4. While emoji are falling, tap a card and scroll.
5. Open Today on the other device (web or Android) without Days won changing.
6. Turn on the phone's Remove animations (Android: Settings → Accessibility) or the browser's reduce motion setting, wait for Days won to go up, and open Today.
7. Delete the account.
**Expected:** Step 1 shows no rain. Step 2 shows no rain, because the switch is off; the account still records the new total. Step 3: the first open shows no rain (the total has not moved since step 2); after Days won goes up, emoji (🎉 🌱 ⭐ 🙌 ✨) fall over Today for about three seconds and stop, with no sound. Step 4: the tap opens the card and the screen scrolls; the rain blocks nothing. Step 5 shows no rain, because the account has already seen this total. Step 6 shows no rain and records the total. Step 7 removes the `user_ui_preferences` row, `days_won_seen` with it. On Android the drops match the web's emoji, sizes and order.
**Result:** web ☐ android ☐ — notes:
