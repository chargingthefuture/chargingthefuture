# Demo videos

Short demo clips of the app, recorded by a script instead of by hand. A phone-sized browser signs in
as a demo account and clicks through the screens while it is filmed. A voice reads the narration,
and captions are burned into the picture. When a screen changes, re-run that clip; nobody records
anything again by hand.

## Getting the videos

Run the Actions workflow Demo Videos — Record Clips (`demo-videos.yml`) from the Actions tab on a
phone:

- clips: `all`, or clip names separated by spaces (`peer-programming-goal-board user-guide`).
- voice: leave the default, or use another Piper voice name (list below).

Each clip is attached to the `demo-videos` release as `<clip>.mp4`, with `<clip>.vtt` (captions as a
separate file, for players that take one). Re-running a clip replaces its video there. A clip that
fails does not stop the others; the run goes red and its log names the clip, the step, and what went
wrong on screen.

## Setting up the demo account (once)

Clips are filmed on the live app, signed in as an account in demo mode. Demo mode sends that
account's reads and writes to the `demo` database schema, the staging Stream app and the test ledger,
so the clips show seeded sample people and never real members.

1. In the Clerk dashboard, create a user for the recordings. Its name shows in some clips, so pick a
   plain one such as "Demo".
2. In Unleash, add that user's Clerk id to the targeting of the `demo-mode` flag. Without this step
   the clips would show real member data. Check it before the first run.
3. Run the Seed Demo workflow (`seed-demo.yml`) with that id as `demo_tester_member_id`, so the
   account has an entry, a wallet, a profile and sample data around it.
4. In Infisical (production), add `DEMO_VIDEO_CLERK_USER_ID` with that id.

The workflow signs in with a one-time Clerk sign-in token for that id (`CLERK_SECRET_KEY`, already in
Infisical). No password is stored anywhere.

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
- Each tap shows a coral circle where it lands.
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
