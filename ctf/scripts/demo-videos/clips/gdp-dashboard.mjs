// GDP's dashboard: the Community Value Index, its disclaimer, the member count, members by
// country, then a refresh. Reads only; no write to the demo data.
export default {
  slug: 'gdp-dashboard',
  title: 'GDP: the Community Value Index',
  steps: [
    {
      say: 'GDP shows the value actually exchanged inside the community, live.',
      speak: 'G D P shows the value actually exchanged inside the community, live.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/gdp'));
        await page.getByText('Skills Economy — Live', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'The big number is the Community Value Index. It adds up every exchange since June 12, 2026, and never resets.',
      do: async ({ page, highlight }) => highlight(page.getByText('Cumulative since June 12, 2026', { exact: true })),
    },
    {
      say: 'It is an index, in the spirit of GDP. It is not money, a price, or something you can redeem.',
      speak: 'It is an index, in the spirit of G D P. It is not money, a price, or something you can redeem.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Community Value is one measure/)),
    },
    {
      say: 'Members is how many people are in the community.',
      do: async ({ page, highlight }) => highlight(page.getByText('Members', { exact: true }).locator('xpath=..')),
    },
    {
      say: 'All Countries shows where members are, with anyone who set no location counted on its own line.',
      do: async ({ page, highlight }) => highlight(page.getByText('All Countries', { exact: true }).locator('xpath=..')),
    },
    {
      say: 'Refresh reads the figures again.',
      do: async ({ button, highlight }) => {
        await highlight(button('Refresh'));
        await button('Refresh').click();
      },
    },
  ],
};
