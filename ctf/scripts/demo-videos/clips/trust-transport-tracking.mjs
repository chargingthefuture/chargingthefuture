// TrustTransport's Tracking tab: the member's own requests with their route and status, then a
// refresh. Seed Demo gives the demo account one request, Oakland to San Francisco. Reads only; no
// write to the demo data.
export default {
  slug: 'trust-transport-tracking',
  title: 'TrustTransport: follow your trips',
  steps: [
    {
      say: 'The Tracking tab lists the rides you asked for.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/trust-transport'));
        await page.getByLabel('Pickup location').waitFor({ timeout: 20_000 });
        await button('Tracking').click();
        await page.getByText('Oakland → San Francisco', { exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each card shows where the trip starts and ends, how it is settled, and its status.',
      do: async ({ page, highlight }) => highlight(page.getByText('Oakland → San Francisco', { exact: true }).first().locator('xpath=..')),
    },
    {
      say: 'There is no live map. The status changes as the driver marks progress, and you can message them on the Direct Line.',
      do: async ({ page, highlight }) => highlight(page.getByText('Oakland → San Francisco', { exact: true }).first().locator('xpath=../..')),
    },
    {
      say: 'Refresh reads your trips again.',
      do: async ({ button, highlight }) => {
        await highlight(button('Refresh'));
        await button('Refresh').click();
      },
    },
  ],
};
