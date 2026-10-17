// PeerProgramming's Session tab: joins the cohort's live call and points at its controls. The
// recorder gives the browser a test-pattern camera, so the tile shows that pattern. The call runs on
// the staging video service, because the demo account is in demo mode.
export default {
  slug: 'peer-programming-session',
  title: 'PeerProgramming: the live session',
  steps: [
    {
      say: 'The Session tab is your cohort\'s live video room.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/peer-programming'));
        await button('Session').click();
        await button('Join Session').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Press Join Session. Your camera and microphone turn on, and you see and hear everyone who is there.',
      do: async ({ button, highlight }) => highlight(button('Join Session')),
    },
    {
      say: 'You are live.',
      do: async ({ button }) => {
        await button('Join Session').click();
        await button('Mute').waitFor({ timeout: 45_000 });
      },
    },
    {
      say: 'Mute turns your microphone off.',
      do: async ({ button, highlight }) => highlight(button('Mute')),
    },
    {
      say: 'Stop camera turns your video off.',
      do: async ({ button, highlight }) => highlight(button('Stop camera')),
    },
    {
      say: 'Leave session takes you out of the call.',
      do: async ({ button, highlight }) => highlight(button('Leave session')),
    },
    {
      say: 'You can join again any time.',
      do: async ({ button }) => {
        await button('Leave session').click();
        await button('Join Session').waitFor({ timeout: 20_000 });
      },
    },
  ],
};
