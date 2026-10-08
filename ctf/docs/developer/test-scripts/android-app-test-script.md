# Android app test script

This is the manual test script for the **native Android app** overall. It exists because the
Android app is no longer a full copy of the web product. Under the owner decisions of 2026-07-20 and
2026-10-06 (rule 105), the native app carries the plugins that benefit from being an installed app —
**Chyme, Beacon, PeerProgramming and Foundation, each in full with its admin screens (owner decision, 2026-10-08)**, opened from an **Apps** list — plus **Clerk sign-in,
bug reporting, and settings/account**, and everything else is served by the installable web app.
So instead of testing "parity across the board", this one script walks the entire native app end to
end.

## Before you start

- Use a **real device build** (an EAS `development` or `production` build, or the released APK from
  GitHub Releases). **Do not use Expo Go** — the Chyme background-audio behavior (foreground service)
  and the release signing only exist in a real build.
- Have a test member account that is **approved** (so it passes the Unlock wall), and if possible a
  second account that is **not yet approved** (to check the wall).
- The per-plugin test scripts in this folder (directory, foundation, etc.) are now **web** test
  scripts — those features live on the web app, not on Android.

## AN-1 — Launch and sign in (Clerk)

1. Install and open the app. You should see the "Exit Their Economy / Exit The Psyop" loading screen,
   then the app shell with the **Apps** pill selected and a **You are not signed in** card with a
   **Sign in** button above the content. The card shows on every pill while signed out.
2. Tap **Sign in** and sign in with the approved test account through the Clerk hosted flow.
3. Expect to land back in the app shell with the **Apps** pill selected by default, showing a card
   for each of **Chyme**, **Beacon**, **PeerProgramming** and **Foundation**, and the sign-in card gone. Tapping a card opens that app.
4. If the app hits an error it cannot recover from, it must not close. Expect a dark screen titled
   **Skills Economy stopped because of an error** with a **Reference** (like `M-…`), a **What failed**
   line, and a **Restart the app** button. Screenshot it for the bug report; the reference is also on
   the Sentry event when Sentry is configured.

## AN-2 — Unlock wall

1. Sign out, then sign in with the **not-yet-approved** account.
2. Expect the full-screen Unlock screen instead of the Chyme shell (mirrors the web redirect to
   `/plugin/unlock`).
3. Scroll to the bottom of the Unlock screen and tap **Sign out**, then confirm. Expect the shell
   with the **You are not signed in** card (see unlock test script UNLOCK-M5).
4. Approve that account (or sign in with the approved account) and confirm the shell appears.

## AN-3 — Chyme: join a room and hear audio

1. With the approved account, open **Chyme**.
2. Join a live audio room. Grant the microphone permission when asked.
3. Confirm you can hear other participants (or a second test device) and that you appear in the
   room's participant roster.

## AN-4 — Background audio (the hard requirement) — CH-10

This is the behavior the owner named: a member who navigates away **without closing the app** must
not be dropped from the room, and the audio must keep playing.

1. While in a live Chyme room (AN-3), press the **Home** button or switch to another app.
2. Expect: audio **keeps playing**, a foreground-service notification ("Chyme live audio") is shown,
   and on the other device you **remain in the participant roster** (you are not dropped after the
   ~45s presence window).
3. Return to the app. Expect: still connected to the same room, audio uninterrupted.
4. Only leaving the room (or force-closing the app) should disconnect you.

> This can only be confirmed on a real device build and is a **required release gate**. Source review
> is not enough.

## AN-BC — Back Channel: free 1:1 audio sidebar (spec #1746)

Back Channel is a casual 1:1 audio call with another member who is in the same room right now. Needs a
second test member in the same room.

1. In a live Chyme room with member B present, tap **Back Channel** on B's participant tile.
2. Expect: your tile shows "Invite sent…"; B sees a bottom sheet ("wants a Back Channel") with
   **Accept** / **Decline** — B is not cold-rung into a live call.
3. Have B tap **Accept**. Expect: a full-screen 1:1 call opens on both devices and you can hear each
   other. Confirm the **Foundation note** appears ("For calls with ServiceCredits attached, use
   Foundation instead") — there is **no** credit/tip control anywhere in the call.
4. **Background check (required release gate):** with the call live, press **Home**. Expect: the call
   audio **keeps playing** (it reuses the Chyme foreground service). Return and confirm the call is
   still live. Same class of check as AN-4 — real EAS build only, not Expo Go.
5. Tap **Hang up**. Expect: the call ends for both; there is no call history, no re-contact, no chat.
6. Confirm a Back Channel action never appears on your **own** tile, and is hidden for a **blocked**
   member (either direction).

## AN-BN — Beacon: watch, chat, and go live

1. Open **Beacon** from the Apps list. With nothing live, expect "No live event right now" and, when
   there is one, the last replay, which plays with sound when you press play.
2. While an event is live (started here or on the web), expect the **LIVE AND PUBLIC** badge and the
   video. It starts muted; the player's sound control turns sound on. Signed in, the live chat
   connects and you can post; signed out, a **Sign in to chat** button shows instead.
3. As an admin: the **Go live** card is above the viewer. Type a title and tap **Go live**. Expect
   the "live now" post in the Commons and the broadcast buttons.
4. Tap **Use camera and microphone** and allow both. Expect your own preview and "Your camera and
   microphone are live to the broadcast." Tap **Flip camera**: the preview switches cameras. Talk for
   a minute; a viewer on another device sees and hears you within about 30 seconds.
5. Tap **Share screen** and accept Android's prompt. Expect the preview to show the phone's screen
   and "Your screen is live to the broadcast." Switch to another app for 30 seconds: the viewer keeps
   seeing your screen. Return and tap **Stop sharing**.
6. Tap **End broadcast**. After a minute, the event's Log on the web admin page shows the recording
   started and the recording file ready, and the replay has picture and sound.
7. As a non-admin, the **Go live** card is not shown.

## AN-PP — PeerProgramming: goals, chat, and the live call

Use an approved account that the weekly assignment has placed in a cohort, and a second member of
the same cohort on another device or on the web.

1. Open **PeerProgramming** from the Apps list. Expect the week's topic under the title and the
   **Goals** tab selected, with the goal chips row and the **Up for grabs**, **Doing** and **Done**
   sections stacked one under the other. An account with no cohort sees "You are not in a cohort
   yet, so there is no goal board to show."
2. As the second member, post a goal with two cards. On the phone, tap **Refresh**, then **Take it**
   on one card. Expect the card to move to **Doing** with "You are on it" and the "Post by …" line.
   Type a result and tap **Post result**: the card moves to **Done**.
3. As the goal's owner on the other device, tap **It helped** on that card. On the phone, after
   **Refresh**, the card reads "Done by you · it helped".
4. Open **Chat**. Type a message and tap **Send**: it appears in the list. Tap **Reply** under the
   other member's message, type a reply and tap **Send reply**: it appears under that message. The
   other member sees both after a refresh.
5. Open **Session** and tap **Join session**. Allow the camera and microphone. Expect your own tile,
   and a tile for the second member once they join. Tap **Mute** and **Stop camera**: they mute and
   stop; tap again to turn them back on. Tap **Flip camera**: your tile switches cameras.
6. Tap **Share screen** and accept Android's prompt. Expect the phone's screen shown large above the
   tiles, on the phone and on the other device. Decline the prompt once: expect the calm line asking
   you to try again, and the call carries on. Tap **Stop sharing**.
7. Press **Home** and wait 30 seconds. The other member still sees and hears you. Return to the app:
   the call is still running. Switch to the **Chat** tab and back: the call is still running.
8. Tap **Leave session**. Expect the **Join session** button again, and the other member sees you
   leave.

## AN-FD — Foundation

Since 2026-10-08 the app carries Foundation in full, and every screen should look like the web
Foundation page at phone width. Use two approved accounts: the **provider** (with at least one skill on
their Directory profile) and the **caller**, one on the phone and one on the web or a second phone.
The caller needs enough ServiceCredits for a few blocks.

1. **Browse.** Open **Foundation** from the Apps list. Expect the **Browse / Offer / Quotes** tabs,
   the search box, the "Find providers offering a skill" panel and the provider cards, as on the web.
   Type in the search box: the list narrows while the box keeps focus. Tap a skill chip: the
   "Offering: …" banner appears with **Clear**. Tap the refresh button in the header: its icon spins
   and the list reloads.
2. **Offer (as the provider).** Open **Offer**. Write a listing blurb and tap **Save**: "Saved"
   shows. Turn on **Allow instant 1:1 calls**, set a rate and block length, and tap **Save**. Turn on
   one skill under **Offer your skills**; "1 of N offered" updates.
3. **Call alerts.** Still on **Offer** with instant calls on, tap **Enable call alerts on this device**.
   On Android 13 or later, Android asks to allow notifications: allow it. Expect "On for this device"
   and **Turn off on this device**. Close and reopen the app: it still reads on.
4. **Profile and Request Quote (as the caller).** On **Browse**, tap the provider's card. Expect the
   **Provider Profile** page with **← Back**, **Share**, **Request Quote** and **Connect now**. Tap
   **Request Quote**: the app lands in the **Direct Line** chat. Send a message; the provider sees it
   on the web. Press Android **back**: Foundation opens on **Quotes**, not Apps. Open a profile again
   and tap the header chevron: Foundation's tabs come back.
5. **Quotes.** Back on **Quotes**, the request shows as **Pending** with **Direct Line**. As the
   provider, respond with a price; as either side, tap **Mark the work done** and confirm. After it
   closes, the caller sees **Is this ongoing?**. Record it, then tap **See your ongoing
   arrangements**: **Recurring Activity** opens in the app with the arrangement listed. Press back:
   the Quotes tab returns.
6. **Ring with the app closed.** On the provider's phone, swipe the app away. From the caller, tap
   **Connect now**, pick a send limit, tick the agreement and tap **Start call**. Within a few seconds
   the phone shows a heads-up alert with sound. With discreet pings on (the default) it reads
   "Charging The Future / You have a new update." and never names the caller. Tap it: the app opens on
   the **Incoming call** card with **Decline** and **Answer**.
7. **Ring with the app open.** With the app open on any screen (for example Chyme), ring again: the
   **Incoming call** card appears above it within about 4 seconds.
8. **Answer.** Tap **Answer**. Expect "Connecting", then "In call" and "Connected" once the caller is
   in. Both people hear each other. Android never asks for the camera.
9. **Mute.** Tap **Mute**: the caller stops hearing you and the button reads **Muted**. Tap it again.
10. **Screen off.** Lock the phone for 30 seconds. The caller still hears you. Unlock: the call is
    still running.
11. **Extend once (as the caller on a phone).** Place the call from the phone. Once answered, the
    **This block** strip shows the time left and "1 of N blocks". Tap **Extend** twice quickly. Exactly
    one block is added ("2 of N blocks"), the button reads "Adding block…" while it works, and the
    caller's ServiceCredits drop by one block, not two.
12. **End.** Tap **End call**. Both sides show "Call ended." and the card closes after a moment. The
    Android "Live now" notification is gone.
13. **Decline.** Ring again and tap **Decline** on the phone. The caller sees "Call declined." No
    credits move.
14. **No answer.** Ring again and leave it for a minute. Both sides show "No answer." and nothing rings
    afterwards.
15. **Out of credits (402).** With a caller account that has fewer ServiceCredits than one block, tap
    **Connect now** and **Start call**. The confirmation stays open and shows the reason. Nothing rings.
16. **Sign out.** Turn alerts on, then sign out in **Account & Data**. Ring this account from the web:
    the phone does not ring. Foundation shows the signed-out page with **Join Skills Economy — Free**
    and **Sign in**. Sign in as a different member on the same phone: call alerts read off.
17. **Alerts off.** Tap **Turn off on this device** and ring again with the app closed: no alert. Open
    the app: the ring still appears on screen while it is open.
18. **Admin.** Signed in as an admin, the Foundation header shows **Admin**; a member does not see it.
    Tap it: **Foundation Admin** opens with the five snapshot counts and the **Capacity policy** card,
    and an accent refresh button in the header. Change the quota state, tap
    **Save policy**, and expect "Capacity policy saved.". **Member view** returns to Foundation.

## AN-5 — Back button

1. From any other pill (Chyme, Beacon, PeerProgramming, Foundation, **Report a problem**, **Account & Data**, **Blocked
   members**), press the Android **back** button. Expect: you return to **Apps** (not out of the app).
2. From Apps, press **back** again. Expect: Android leaves the app (default). Back is an explicit
   "leave" — the audio-keeps-playing case is Home/app-switch (AN-4), not back.

## AN-6 — Report a problem (bug reporting)

1. Open the **Report a problem** pill.
2. Tap the entry row to open the report form/modal, fill it in, and submit.
3. Confirm the submission succeeds (no error) and the modal closes.

## AN-7 — Settings / account (Account & Data)

1. Open the **Account & Data** pill.
2. Confirm the account/settings content loads.
3. Toggle the theme if a toggle is present; confirm the app re-themes.
4. Scroll to the bottom: under **Signed in as** your username (or email), tap **Sign out**. A confirm
   asks **Sign out of this device?**; **Stay signed in** closes it with nothing changed.
5. Tap **Sign out** again and choose **Sign out**. Expect the shell to show the **You are not signed
   in** card, and the Account & Data pill to no longer list your data.
6. Close and reopen the app: you are still signed out (the stored session was cleared).
7. Join a room on Chyme, switch to Account & Data, and sign out. Go back to Chyme: you are not in
   the room as a member and the Android "Chyme live audio" notification is gone.

## AN-8 — Blocked members

1. Open the **Blocked members** pill.
2. Confirm the list loads (empty state if you have blocked no one).
3. If you have a blockable member available, confirm block/unblock works.

## AN-9 — "The rest of the app is on the web"

1. Confirm the subtle footer line under the content points members to the web app
   (`app.chargingthefuture.com`) for everything outside the Chyme keep-list.

## What is intentionally NOT in the Android app

Directory, LightHouse, TrustTransport, SocketRelay, SkillsHunt, Workforce, GDP,
ServiceCredits, Weekly Performance, Feed/Announcements, Mood, GentlePulse, SkillUp,
and the rest are **web-only** now (installable PWA). If any of these appears in the native app
without an owner decision adding it to the rule 105 keep-list, that is a regression.
