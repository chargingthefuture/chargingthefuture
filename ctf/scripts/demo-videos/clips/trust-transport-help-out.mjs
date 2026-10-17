// TrustTransport's Help tab: open requests from other members that a driver can offer on. Reads
// only; no write to the demo data.
export default {
  slug: 'trust-transport-help-out',
  title: 'TrustTransport: help out',
  steps: [
    {
      say: 'If you can drive or deliver, open the Help tab.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/trust-transport'));
        await page.getByLabel('Pickup location').waitFor({ timeout: 20_000 });
        await button('Help').click();
        await page.getByText('Open requests', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'To keep people safe, a request shows only what kind of help is needed and how it is settled.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Open requests from the community you can offer to help with/)),
    },
    {
      say: 'The pickup and drop-off are shared with you only if the person accepts your offer.',
      do: async ({ page, highlight }) => highlight(page.getByText('Open requests', { exact: true })),
    },
  ],
};
