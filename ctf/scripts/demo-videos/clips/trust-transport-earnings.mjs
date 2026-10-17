// TrustTransport's Earnings tab: a record of what completed trips were worth. Reads only; no write
// to the demo data.
export default {
  slug: 'trust-transport-earnings',
  title: 'TrustTransport: your earnings record',
  steps: [
    {
      say: 'The Earnings tab is a record of what your completed trips were worth.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/trust-transport'));
        await page.getByLabel('Pickup location').waitFor({ timeout: 20_000 });
        await button('Earnings').click();
        await page.getByText('Recorded earnings', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'ServiceCredits go straight to your wallet when a trip completes. Cash or anything else is arranged between you and the other person.',
      speak: 'Service Credits go straight to your wallet when a trip completes. Cash or anything else is arranged between you and the other person.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^A record of what you.ve earned by completing trips/)),
    },
    {
      say: 'The app never holds any cash, so this is a record, not a balance you can withdraw.',
      do: async ({ page, highlight }) => highlight(page.getByText('Recorded earnings', { exact: true })),
    },
  ],
};
