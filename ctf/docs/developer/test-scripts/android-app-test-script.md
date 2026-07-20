# Android app test script

This is the manual test script for the **native Android app** as a whole. It exists because the
Android app is no longer a full copy of the web product. Under the owner decision of 2026-07-20
(rule 105), the native app is narrowed to a small keep-list — **Clerk sign-in, Chyme live audio,
bug reporting, and settings/account** — and everything else is served by the installable web app.
So instead of testing "parity across the board", this one script walks the whole native app end to
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
   then the sign-in flow.
2. Sign in with the approved test account through the Clerk hosted flow.
3. Expect to land in the app shell with the **Chyme** pill selected by default (not a Home feed).

## AN-2 — Unlock wall

1. Sign out, then sign in with the **not-yet-approved** account.
2. Expect the full-screen Unlock screen instead of the Chyme shell (mirrors the web redirect to
   `/plugin/unlock`).
3. Approve that account (or switch back to the approved account) and confirm the shell appears.

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

## AN-5 — Back button

1. From Chyme, tap the **Report a problem**, **Account & Data**, or **Blocked members** pill.
2. Press the Android **back** button. Expect: you return to **Chyme** (not out of the app).
3. From Chyme, press **back** again. Expect: Android leaves the app (default). Back is an explicit
   "leave" — the audio-keeps-playing case is Home/app-switch (AN-4), not back.

## AN-6 — Report a problem (bug reporting)

1. Open the **Report a problem** pill.
2. Tap the entry row to open the report form/modal, fill it in, and submit.
3. Confirm the submission succeeds (no error) and the modal closes.

## AN-7 — Settings / account (Account & Data)

1. Open the **Account & Data** pill.
2. Confirm the account/settings content loads.
3. Toggle the theme if a toggle is present; confirm the app re-themes.
4. Sign out from here and confirm you return to the sign-in flow.

## AN-8 — Blocked members

1. Open the **Blocked members** pill.
2. Confirm the list loads (empty state if you have blocked no one).
3. If you have a blockable member available, confirm block/unblock works.

## AN-9 — "The rest of the app is on the web"

1. Confirm the subtle footer line under the content points members to the web app
   (`app.chargingthefuture.com`) for everything outside the Chyme keep-list.

## What is intentionally NOT in the Android app

Directory, LightHouse, TrustTransport, SocketRelay, Foundation, SkillsHunt, Workforce, GDP,
ServiceCredits, Weekly Performance, Feed/Announcements, Mood, GentlePulse, LevelUp, PeerProgramming,
and the rest are **web-only** now (installable PWA). If any of these appears in the native app, that
is a regression against the Chyme-only scope (rule 105).
