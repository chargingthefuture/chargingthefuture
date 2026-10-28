# Account & Data — Manual Test Script

> **Android: not applicable.** This surface is web-only (rule 105); the installable web app (PWA)
> serves phones. Test on web only: the phone-width layout at desktop and ~390px.

> Walk these steps on a real device to confirm the Account & Data page (`/account/data`) works end
> to end. Source of truth: the account deletion registry
> (`ctf/packages/web/lib/account/deletion-registry.ts`) and the non-plugin feature inventory §1.2.

| | |
|---|---|
| **Surface** | `/account/data` (Your Data & Privacy), `/account` for AD-9 and AD-10, the 3.1 Today screen for AD-11, rooms in 3.1 for AD-12, + New for AD-13, Me for AD-14, Activity for AD-15, People for AD-16, Days won for AD-17 and mute for AD-18 |
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
4. On Today, tap the word **Avenhood** in the title, then tap it again. On Me, read the About card.
5. Open `/apps/directory/invites` and one invite's page from it, then come back to `/`.
6. On the Me tab, tap **Back to 3.0**.
**Expected:** Step 1 lands on the 3.1 home: forest green and gold, dark, the date above "Today in the
Avenhood", and the tab bar. Each tab shows its title; Me shows your picture, your handle and Back to 3.0, and the
others say the screen is still being built. The address carries the tab (`/?tab=people`), and back
returns to the tab before. Tapping Avenhood opens and closes its definition under the title; the
About card on Me shows the same definition and what an Aven is. The invite wall and the invite page open and work as before. Back to 3.0
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
6. If you have not answered the Quora account removals survey, find its card ("Has Quora removed an
   account of yours?"), answer the survey, then reopen Today.
**Expected:** Step 1 shows the Main Room card (LIVE only while somebody is in it), with the TI Radio
talk that is on ("On now: …") or next ("Next: … · Today · 9:00 PM") when one is booked, and the day's cards,
newest first; after the reload the cards appear at once from the saved copy and then refresh. No
card shows a street address, a city on a request, or where a ride goes. Step 2 opens the card's full
text and closes it, a check mark appears on it, and "1 of N done" appears above the chips (it was
not there before). Step 3 shows only that kind. Step 4 copies the card's address, and the hidden card
is gone and stays gone after a reload. Step 5 opens the room inside 3.1 (AD-12). If a source fails, a
line under the chips names it and the rest of the cards still show. A member who is not a Weaver of
the Commons never sees a Weavers card or any line naming it. Step 6: the survey card is gone once the survey is answered.
**Result:** web ☐ — notes:

## AD-12 · Rooms in 3.1

**Role:** approved member; a second account that is a Weaver of the Commons · **Precondition:** on 3.1.
**Steps:**
1. On Today, tap the Main Room card's button while nobody is in the room.
2. Tap **Listen in**. Then tap the Today, People and Me tabs in turn.
3. Tap the bar above the tab bar. Then tap **Back**/**Keep listening and browse** at the top.
4. On the bar, tap **Leave quietly**.
5. Sign in as the Weaver and open the Weavers of the Commons card on Today.
**Expected:** Step 1 opens the room inside the app (no page change): "Main Room", "Open to everyone",
the talk line when one is booked, and "Quiet right now" with the readings player. Step 2 joins muted
and shows "Guests may be listening. Anyone can hear this room without an account."; the buttons read
Leave quietly and Bring someone in (on another member's tile). Moving between tabs keeps the audio
going, and a bar above the tab bar shows the room's name and how many are in it. Step 3 opens the
room again, then puts it back in the bar. Step 4 leaves the call and the bar goes away. Step 5 shows
the card only to the Weaver; the room reads "Private to Weavers of the Commons" and has no guest
notice. The 3.0 Chyme page still reads Join Room, Leave and Back Channel.
**Result:** web ☐ — notes:

## AD-13 · + New: Talk, Ask, Offer and Story

**Role:** approved member; an account not yet approved · **Precondition:** on 3.1.
**Steps:**
1. Open the + tab. Under Talk, choose a time, type a topic and tap **Book the talk**.
2. Open the TI Radio guide and Today's Main Room card.
3. Try to book a second slot the same day, then sign in as the account not yet approved and open +.
**Expected:** Step 1 confirms "Booked for <day>. It shows on Today and in the TI Radio schedule." and
the time leaves the list. Step 2 shows the booking on the guide and, when it is the next talk, on
the Main Room card. Step 3 shows the route's own reason when a limit is hit, and the account not
yet approved sees "Booking a talk needs Unlock approval." with a link to Unlock.
4. Under Ask, type "ride". Tap "A ride to the pharmacy or grocery store", add a line and tap **Post the
   ask**.
5. Tap each Offer choice and the Story link.
**Expected (4 and 5):** Typing shows only suggestions that contain every word typed; with nothing
typed, one from each group. The hint "Everyone can read this. Keep times and places for the private
conversation." sits under the box. Posting says "Posted. It shows on Today, and answers come to
Activity." and the ask appears on Today and in SocketRelay with the tag "Getting around" and no city.
A place to stay opens LightHouse, Hours Mutual Time, A ride TrustTransport, A skill Foundation, and the
Story link the Knowledge Library.
**Result:** web ☐ — notes:

## AD-14 · Me and Settings in 3.1

**Role:** approved member; an admin · **Precondition:** on 3.1.
**Steps:**
1. Open Me.
2. Tap Send, go back, tap History, go back, tap Receive.
3. Under Settings → Colors, pick Burgundy, then Light. Reload the page.
4. Tap Account and data, the survey, Wallpapers and The Android app in turn.
5. Sign in as the admin and open Me.
**Expected:** Step 1 shows the avatar and handle, ServiceCredits with the balance in credits (never
money words), ClickLog, Trust and Reader, About with the Avenhood definition, and Settings; no tile
for making or browsing posts. Step 2 opens ServiceCredits on its Send tab, then on the wallet tab with
recent transactions; Receive copies @handle and says so. Step 3 recolors the app at once and keeps the
choice after the reload. Step 4 opens each place; Wallpapers and the Android app open GitHub releases
filtered to each. Step 5 adds a System Architect entry that opens the admin screens; a member who is
not an admin never sees it.
**Result:** web ☐ — notes:

## AD-15 · Activity in 3.1

**Role:** approved member; a second member · **Precondition:** on 3.1.
**Steps:**
1. As the second member, reply to one of the first member's Commons posts, send them 1 ServiceCredit,
   and invite them to a Recurring Activity.
2. As the first member, open Activity. Open the reply.
3. Tap **Mark all as read**.
**Expected:** Step 2 shows the invite under "Needs your answer" and the reply and the credits under
"What happened", newest first, each with how long ago and "New" on the unread ones (no red badge
anywhere). Opening the reply goes to it and its "New" is gone on return. Step 3 clears every "New".
With nothing recorded, Activity reads "Nothing yet. Replies, credits sent to you and confirmations
show here."
**Result:** web ☐ — notes:

## AD-16 · People in 3.1

**Role:** approved member; a signed-in member not yet approved · **Precondition:** on 3.1; one
claimed profile whose owner offers a skill in Foundation.
**Steps:**
1. Open People. Page forward and back, then reload on page 2.
2. Tap **Offering now**, then **Everyone**. Search a skill name.
3. On a person who offers a skill, tap **Request a quote**; on another, tap **Profile**.
4. As the member not yet approved, open People.
**Expected:** Step 1 lists 20 people a page with "1–20 of N", people who offer something first; the
reload stays on page 2. Offered skills are filled in the Offer color and listed skills outlined, and a
skill shows once. Step 2 keeps only people offering something, then everyone again; the search narrows
to people with that skill in their name, headline, job title or listing. Step 3 opens the Foundation
provider page and the Directory profile. Request a quote never shows for someone offering nothing.
Step 4 shows the route's refusal reason instead of any person.
**Result:** web ☐ — notes:

## AD-17 · Days won, and the measures on Adoption

**Role:** two approved members; an admin · **Precondition:** on 3.1.
**Steps:**
1. Open Today and note "Days the Avenhood has won".
2. Both members join the Main Room and stay 20 minutes. Then reload Today.
3. As the admin, open `/admin/adoption` and read "Days won and retention". Tap **Copy as text**.
**Expected:** Step 1 shows the total and "N this week. A day won is 8 hours members spent together
in rooms and calls, or helping with each other's tasks." Step 2 raises the total by about 40 minutes
÷ 480 (0.1 after rounding). Step 3 shows Days won, Retained (with the share and the 20% target),
Came back, Every day and time to unlock as counts only, with no member named; Copy as text pastes the
same lines. A failed read shows "Could not read the measures:" with the reason.
**Result:** web ☐ — notes:

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

**Role:** signed out; then a member · **Precondition:** an open ride request, an open SocketRelay ask
and a PeerProgramming goal exist.
**Steps:**
1. Signed out, open `/today`.
2. Tap **Listen in** on the Main Room card, then come back and tap **Sign in**.
3. Signed in, open `/today`.
**Expected:** Step 1 shows "Today in the Avenhood", a Sign in button, Days won, the Main Room card and
public cards: rides wanted, Skill Up cohorts, SkillsHunt, numbers, replays. No card shows a name, and
no SocketRelay ask, goal, listing, announcement, invitation or Mood card appears. The card menu has
no Mute. Step 2 opens the public listen page, then the sign-in page. Step 3 lands on the home page.
**Result:** web ☐ — notes:
