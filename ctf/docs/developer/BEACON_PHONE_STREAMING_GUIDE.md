# Beacon — How to Stream From a Phone

This is the step-by-step for the "Phone demo" panel on `/admin/beacon`: what the **RTMP URL** and
**Stream key** are, where to paste them, and what to check when nothing shows up for viewers.

**Why a separate app at all:** a phone's web browser cannot record the phone's own screen. So Beacon
does not capture the screen itself — it gives you a private address to send video to, and you send it
from a normal broadcaster app (Larix Broadcaster, Streamlabs, Prism Live, OBS on a computer, and so
on). That address is the RTMP URL, and the password for it is the stream key.

- **RTMP URL** — where the video goes. Looks like `rtmps://ingress.stream-io-api.com:443/…`.
- **Stream key** — proves the video is coming from you. It is a long token, shown masked as dots.
  Treat it like a password: anyone holding it can broadcast into your event.

Both are created fresh for each broadcast. They are not reusable settings — see
[Each broadcast gets new values](#each-broadcast-gets-new-values) below.

---

## Before you start

- You are signed in as an admin (the Beacon admin screen is admin-only).
- A broadcaster app is installed on the phone. **Larix Broadcaster** (free, iOS and Android) is the
  one this project has used; any RTMP app works.
- To show the *app itself*, the broadcaster app needs screen capture — on iOS that is Larix's screen
  broadcast (iOS "Screen Recording" control, then pick Larix); on Android it is Larix's
  screen-capture source. To show yourself on camera instead, the phone camera is enough.
- Wi-Fi or a solid mobile signal. Video going out needs roughly 2–3 Mbps of upload for 720p.

---

## Steps

### 1. Create the event

On `/admin/beacon`, fill in the title and description and create the event. It starts as a draft —
nothing is public yet, and no RTMP details exist yet.

### 2. Tap "Go live"

The RTMP URL and stream key **only appear after you tap "Go live"**. That tap is what opens the
broadcast on the video service and mints the details. Once it succeeds:

- the button changes to **End broadcast**,
- the **Phone demo** panel appears with **RTMP URL** and **Stream key**, each with a **Copy** button,
- a "live now" notice is posted to the Commons.

If instead you get a red banner ("Broadcast input unavailable — …"), read the rest of that line: it
names the step that failed. Nothing further will work until that is resolved.

### 3. Copy the two values to the phone

Tap **Copy** next to **RTMP URL**, paste it into the broadcaster app, then come back, tap **Copy**
next to **Stream key**, and paste that. The key is masked on screen on purpose; **Copy** still copies
the real value.

If you are running the admin screen on a computer and broadcasting from the phone, send yourself the
two values in a way you are comfortable with — but do not post the stream key anywhere others can
read it, and do not keep it after the broadcast.

### 4. Set up the connection in Larix Broadcaster

1. Open Larix → **Settings** (gear) → **Connections** → **New connection**.
2. **URL** — paste the RTMP URL.
   - Larix has a single URL box. Most single-box apps expect the URL and the key joined with a
     slash: `<RTMP URL>/<stream key>`. Paste the URL, add `/`, then paste the key on the end.
   - Apps that show two boxes (OBS: "Server" and "Stream Key") take them separately — URL in the
     first, key in the second. Do not join them there.
3. **Name** — anything you will recognise ("Beacon").
4. Save, and make sure the connection is ticked/active.
5. Back in **Settings** → **Video**: set **1280x720**, 30 fps, bitrate around 2500 Kbps.
   The saved replay is recorded at 720p landscape, so **hold the phone sideways** — a portrait
   broadcast is recorded with black bars down both sides.

### 5. Start sending

Press the record/broadcast button in the app. Larix shows the connection turning green, along with
the bitrate going out. If it retries or goes red, see [When it does not work](#when-it-does-not-work).

### 6. Check what viewers see

Open `/apps/beacon` — the public page — in another browser or on another device, ideally signed out,
because that is what a visitor gets. Video takes a few seconds to appear after you start sending;
live video is delivered with a delay of roughly 10–30 seconds behind real time, so do not judge it by
the first two seconds.

### 7. Run the chat

The admin screen shows the live chat and the moderation controls: paste a member's user id and
**Mute** or **Ban** them, or turn **Slow-mode 10s** on and off. Watching the broadcast needs no
account; posting a message does.

### 8. Tap "End broadcast"

Stop the broadcaster app, then tap **End broadcast** on the admin screen. **Do not skip this** — it
is what stops distribution and stops the cost running. The replay is posted to the Commons once the
recording is ready.

---

## Each broadcast gets new values

The stream key is a freshly signed token, and a new one is issued every time you tap "Go live". So:

- Do not save the connection details and reuse them next week — the key will have moved on.
- Copy the values right before you broadcast, not hours ahead.
- Set the connection up again (or paste over the old one) for each event.

Old values are not "wrong" in a way the app can explain to you — the broadcaster app will simply fail
to connect, or connect and be rejected.

---

## When it does not work

**The broadcaster app will not connect / keeps retrying.**

- The URL and the key are swapped, or the key was joined onto the URL in an app that has two separate
  boxes (or not joined in an app that has only one). Check step 4.
- The key is from an earlier broadcast. Tap **End broadcast**, tap **Go live** again, and re-copy
  both values.
- The URL was truncated by pasting from the on-screen text instead of using **Copy** — the box only
  shows the first part (`rtmps://ingre…`). Always use the **Copy** button.
- The network blocks outgoing RTMP. Try mobile data instead of the Wi-Fi you are on.

**The app says it is sending, but viewers see nothing.**

- Give it 30 seconds. Live video is delayed by design.
- Confirm the event is actually live: the admin screen should show **End broadcast**, not **Go live**.
- If the public page still shows nothing after a minute, use the computer fallback: open
  `/admin/beacon` on a computer for the same live event and click **Share screen** once. Starting a
  share is what tells the video service to begin the public broadcast and the recording. This is a
  known rough edge in the phone-only path — see below.

**The picture is soft or stalls.** Lower the bitrate in the broadcaster app (1500–2000 Kbps) rather
than raising it. Upload capacity, not the phone, is almost always the limit.

**The broadcast ended but no replay appeared.** The recording is delivered by the video service after
the event ends and is posted to the Commons when it arrives; it is not immediate.

---

## Known rough edge — phone-only broadcasts and the public feed

The public video feed and the recording are started by
`POST /api/beacon/[id]/start-broadcast`. Today that call is only made from the in-browser screen-share
control (`ctf/packages/web/components/beacon/beacon-host-stage.tsx`), when a screen share starts. A
phone pushing RTMP does not trigger it.

Whether a phone-only broadcast reaches viewers therefore depends on the video service's own call-type
settings (whether it begins the public feed automatically once video arrives). If it does not, the
symptom is exactly the one above: the phone reports it is sending, and the public page stays empty.

- **Working around it now:** open the same live event on `/admin/beacon` from a computer and click
  **Share screen** once. That starts the public feed and the recording for the whole broadcast,
  including the phone's video.
- **The proper fix:** call `start-broadcast` when RTMP video begins as well — for example from the
  video service's ingress webhook, or a short retry after "Go live" that starts the public feed once
  video is present. Not implemented yet.

---

## Where this lives in the code

| What | File |
|---|---|
| The RTMP URL + key handed to the admin screen | `ctf/packages/web/app/api/beacon/[id]/ingest/route.ts` |
| Opening the broadcast, the RTMP address, going live, ending | `ctf/packages/web/lib/beacon/stream.ts` |
| The admin screen (Go live, Copy rows, moderation, End) | `ctf/packages/web/components/beacon/beacon-admin-shell.tsx` |
| The in-browser screen-share input | `ctf/packages/web/components/beacon/beacon-host-stage.tsx` |
| The public viewer | `ctf/packages/web/components/beacon/beacon-viewer.tsx` |
| Full plugin inventory | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-beacon-feature-inventory.md` |
| Manual test steps | `ctf/docs/developer/test-scripts/beacon-test-script.md` |
