// LightHouse: the Matches tab, showing the demo account's stay request. Makes no writes.
export default {
  slug: 'lighthouse-matches',
  title: 'LightHouse: your matches',
  steps: [
    {
      say: 'The Matches tab lists the stays you have asked for.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/lighthouse'));
        await button('Matches').waitFor({ timeout: 20_000 });
        await button('Matches').click();
        await page.getByText('Your Matches', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each request shows where it stands. Pending means the host has not answered yet.',
      do: async ({ page, highlight }) => highlight(page.getByText('Match: Pending').first()),
    },
    {
      say: 'It also names the listing you asked about.',
      do: async ({ page, highlight }) => highlight(page.getByText('Property: Bright 1BR in Mission District').first()),
    },
    {
      say: 'Once a host accepts, Direct Line opens a private chat between the two of you.',
      do: async ({ button, highlight }) => highlight(button('Direct Line')),
    },
  ],
};
