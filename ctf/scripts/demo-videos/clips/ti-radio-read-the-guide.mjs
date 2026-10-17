// The TI Radio guide, signed out, to show that reading the schedule needs no account. Nothing is
// pressed and nothing is written.
export default {
  slug: 'ti-radio-read-the-guide',
  title: 'TI Radio: reading the schedule',
  signIn: false,
  steps: [
    {
      say: 'TI Radio is the schedule of live discussions members host in Chyme. Reading it needs no account.',
      speak: 'T I Radio is the schedule of live discussions members host in Chyme. Reading it needs no account.',
      do: async ({ page, app }) => {
        await page.goto(app('/ti-radio'));
        await page.getByText(/Times shown in/).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Every time is shown in your own timezone, and the page names the zone it found.',
      do: async ({ page, highlight }) => highlight(page.getByText(/Times shown in/)),
    },
    {
      say: 'The slot happening right now is marked On air. It tells you whether to open Chyme now.',
      do: async ({ page, highlight }) => highlight(page.getByText('On air', { exact: true }).first()),
    },
    {
      say: 'A name on the schedule is not an endorsement. Nobody reviews a slot before it appears, and the rules still apply in the room.',
      do: async ({ page, highlight }) => highlight(page.getByText(/A slot is taken, not granted/)),
    },
    {
      say: 'Open Chyme takes you to the room where everyone meets.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: /Open Chyme/ })),
    },
  ],
};
