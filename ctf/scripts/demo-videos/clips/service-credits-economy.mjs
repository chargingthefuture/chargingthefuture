// ServiceCredits' Economy tab: the community-wide credit figures. Reads only; no write to the demo
// data.
export default {
  slug: 'service-credits-economy',
  title: 'ServiceCredits: the economy',
  steps: [
    {
      say: 'The Economy tab shows the community\'s figures, not your own.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/service-credits'));
        await page.getByText('Your Balance', { exact: true }).waitFor({ timeout: 20_000 });
        await button('Economy').click();
        await page.getByText('In circulation', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Every figure is a count of credits. They are not money and cannot be cashed out.',
      do: async ({ page, highlight }) => highlight(page.getByText(/They are not money and cannot be cashed out/)),
    },
    {
      say: 'In circulation, total issued and total burned count credits across the community.',
      do: async ({ page, highlight }) => highlight(page.getByText('In circulation', { exact: true }).locator('xpath=..')),
    },
    {
      say: 'Sent in last 30 days is how many credits moved between members over the past month.',
      do: async ({ page, highlight }) => highlight(page.getByText('Sent in last 30 days', { exact: true }).locator('xpath=..')),
    },
  ],
};
