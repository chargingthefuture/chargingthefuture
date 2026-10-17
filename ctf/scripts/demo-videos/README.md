# Demo videos

Short demo clips of the app, recorded by a script instead of by hand. A phone-sized browser signs in
as a demo account and clicks through the screens while it is filmed. A voice reads the narration,
and captions are burned into the picture. When a screen changes, re-run that clip; nobody records
anything again by hand.

## Getting the videos

Run the Actions workflow Demo Videos — Record Clips (`demo-videos.yml`) from the Actions tab on a
phone:

- clips: `all`, or clip names separated by spaces (`peer-programming-goal-board user-guide`).
- account: `member` (the default) or `admin`.
- voice: leave the default, or use another Piper voice name (list below).

Each run publishes a release of its own, `demo-videos-<run number>`, with every clip it recorded as
`<clip>.mp4` and `<clip>.vtt` (captions as a separate file, for players that take one). The run's
summary page links it, and the newest is at the top of the repository's Releases list. Releases here
cannot be changed once published, so a re-run makes a new release rather than replacing a video. A clip that
fails does not stop the others; the run goes red and its log names the clip, the step, and what went
wrong on screen.

## Setting up the demo account (once)

Clips are filmed on the live app, signed in as an account in demo mode. Demo mode sends that
account's reads and writes to the `demo` database schema, the staging Stream app and the test ledger,
so the clips show seeded sample people and never real members.

The account you already seed the demo schema with works as it is: it is in demo mode and has sample
data around it. Two things to know:

- Its name and avatar show wherever the app shows the signed-in member.
- If it is an admin account, admin controls show in the clips. A plain member account films the way
  a member sees the app.

Store the two demo accounts' Clerk user ids as repository variables (Settings → Secrets and
variables → Actions → Variables):

| Variable | Account |
|---|---|
| `DEMO_VIDEO_CLERK_USER_ID` | The member demo account. Films the clips by default, and is the account Seed Demo seeds. |
| `DEMO_VIDEO_CLERK_ADMIN_ID` | The admin demo account. Films the clips when `account` is set to `admin`, and is seeded as the admin tester. |

Both workflows read them, so neither box has to be typed. A box filled in still wins for that run. A
secret with the same name works too, and Infisical is read last.

It also needs `CLERK_SECRET_KEY`, read from the GitHub secret of that name first and Infisical
second. Infisical is optional: if it cannot be reached, the run carries on with the GitHub secrets.
The workflow signs in with a one-time Clerk sign-in token for that id. No password is stored
anywhere.

A separate recording account instead: create the user in Clerk, add its id to the `demo-mode`
Unleash flag (without this the clips would show real members), and run Seed Demo with it as
`demo_tester_member_id`.

The `user-guide` clip needs no sign-in, so it is the clip to run first to check that recording, voice
and captions work.

## Adding a clip

One file per clip in `clips/`, named after its slug. Each step is one thing on screen and the
sentence that goes with it:

```js
export default {
  slug: 'commons-first-post',          // the video's file name
  title: 'Commons: your first post',
  // signIn: false,                    // only for pages that need no account
  steps: [
    {
      say: 'This is Commons, the group chat.',           // the caption, word for word
      speak: 'This is Commons, the group chat.',         // optional: spelling for the voice only
      do: async ({ page, app }) => {                      // what happens on screen first
        await page.goto(app('/'));
        await page.waitForLoadState('networkidle');
      },
    },
    { say: 'Scroll for older posts.', do: async ({ scroll }) => scroll(600) },
  ],
};
```

- `do` runs first; the narration starts once it finishes, so the voice describes what is already on
  screen. The next step waits until the sentence is over.
- `page` is a Playwright page. Prefer pressing things by their visible text
  (`page.getByText('+ Add your goal').click()`), which survives restyling.
- `app(path)` builds an address on the app, `scroll(pixels)` scrolls like a thumb (negative goes up),
  and `pause(seconds)` holds the screen.
- `button(name)` finds a button by its visible text or its aria-label, exactly, so `button('Session')`
  is the tab and not "Join Session".
- `highlight(locator)` rings an element in coral and dims the rest of the screen while the step's
  sentence plays. The ring goes when the next step starts. The usual pattern is one step that
  highlights a button and says what it does, then a step that presses it.
- Each tap shows a coral circle where it lands.
- The browser has a test-pattern camera and a tone for a microphone, already allowed, so a clip can
  join a live call. Demo mode puts that call on the staging video service.
- Use `speak` when the voice mispronounces a name: "Peer Programming" for PeerProgramming,
  "Service Credits" for ServiceCredits. Captions always show `say`.
- Keep a clip to one task and under a minute. The narration follows the same rules as the blog:
  plain words, and every part named the way the guide names it.

## Voices

Piper voices are listed at https://huggingface.co/rhasspy/piper-voices (`en_US-lessac-medium`,
`en_US-amy-medium` and `en_US-ryan-high` among others). The first run with a new
voice downloads it; later runs use the cached copy.

## Running it locally

```sh
npm i -g playwright
DEMO_TTS=tone DEMO_OUT_DIR=/tmp/demo node ctf/scripts/demo-videos/record.mjs user-guide
```

`DEMO_TTS=tone` writes a quiet tone the length of each sentence instead of a voice, which is enough
to check timing and captions. `DEMO_APP_URL` points the browser at a different copy of the app.
