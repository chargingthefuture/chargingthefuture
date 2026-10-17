// Joins the Chyme main room on the staging audio service, points at the controls, and leaves again
// in under 20 seconds. The microphone stays muted. Writes a presence row to the demo data while
// joined; leaving removes it.
export default {
  slug: 'chyme-join-and-leave',
  title: 'Chyme: join and leave the room',
  steps: [
    {
      say: 'Press Join Room to connect to the live audio.',
      do: async ({ page, app, button, highlight }) => {
        await page.goto(app('/apps/chyme'));
        await button('Join Room').waitFor({ timeout: 20_000 });
        await highlight(button('Join Room'));
      },
    },
    {
      say: 'You are in. You start muted, so nobody hears you until you choose.',
      do: async ({ button }) => {
        await button('Join Room').click();
        await button('Unmute').waitFor({ timeout: 45_000 });
      },
    },
    {
      say: 'Unmute turns your microphone on. Press it again to mute.',
      do: async ({ button, highlight }) => highlight(button('Unmute')),
    },
    {
      say: 'Raise Hand shows you want to speak. It stays up until you lower it.',
      do: async ({ button, highlight }) => highlight(button('Raise Hand')),
    },
    {
      say: 'Leave takes you out of the room.',
      do: async ({ button, highlight }) => highlight(button('Leave')),
    },
    {
      say: 'You can join again any time.',
      do: async ({ button }) => {
        await button('Leave').click();
        await button('Join Room').waitFor({ timeout: 20_000 });
      },
    },
  ],
};
