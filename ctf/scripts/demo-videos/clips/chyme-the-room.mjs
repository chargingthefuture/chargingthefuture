// A tour of the Chyme screen before joining: the rooms rail, the room header and the Join Room
// button. Nothing is pressed and nothing is written.
export default {
  slug: 'chyme-the-room',
  title: 'Chyme: the room',
  steps: [
    {
      say: 'Chyme is a live audio room. Members listen and speak together in real time.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/chyme'));
        await button('Join Room').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'The row at the top lists the rooms. Main Room is open to all members.',
      do: async ({ page, highlight }) => highlight(page.getByRole('tab', { name: /Main Room/ })),
    },
    {
      say: 'Hosts book their own times. A name here is not an endorsement, and the rules still apply in the room.',
      do: async ({ page, highlight }) => highlight(page.getByText(/Hosts book their own slots/)),
    },
    {
      say: 'Under the room name: how many people are in the room, and the name you are signed in as.',
      do: async ({ page, highlight }) => highlight(page.getByText(/Signed in as/).first()),
    },
    {
      say: 'Join Room connects you to the live audio.',
      do: async ({ button, highlight }) => highlight(button('Join Room')),
    },
  ],
};
