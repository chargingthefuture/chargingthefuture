// Beacon's screen when nothing is live. Points at the recordings link without opening it, since it
// leaves the app for the blog. Nothing is written.
export default {
  slug: 'beacon-when-nothing-is-live',
  title: 'Beacon: when nothing is live',
  steps: [
    {
      say: 'Beacon is where live broadcasts from Farah play. Anyone with the link can watch.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/beacon'));
        await page.getByText('No live event right now', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'When nothing is live, Beacon says so. A broadcast shows up here as soon as it starts.',
      do: async ({ page, highlight }) => highlight(page.getByText('No live event right now', { exact: true }).locator('..')),
    },
    {
      say: 'During a broadcast, signed-in members can chat and react. The broadcast and the chat are public.',
      do: async ({ page, highlight }) => highlight(page.getByText(/Watch with just a link; sign in to chat and react/)),
    },
    {
      say: 'Missed one? This link opens the blog\'s page of past recordings, which play without an account.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: 'Missed it? Watch the recordings' })),
    },
  ],
};
