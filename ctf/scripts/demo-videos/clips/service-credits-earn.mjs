// ServiceCredits' Earn tab: the few rewards the platform gives, and the peer-to-peer exchanges that
// are the main way credits move. Reads only; no write to the demo data.
export default {
  slug: 'service-credits-earn',
  title: 'ServiceCredits: ways to earn',
  steps: [
    {
      say: 'The Earn tab explains where credits come from.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/service-credits'));
        await page.getByText('Your Balance', { exact: true }).waitFor({ timeout: 20_000 });
        await button('Earn').click();
        await page.getByText('Earn ServiceCredits', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'A few rewards come from the platform, such as verifying your account.',
      do: async ({ page, highlight }) => highlight(page.getByText('Verify your account', { exact: true }).locator('xpath=../..')),
    },
    {
      say: 'The main way is helping another member. They send you credits for it.',
      do: async ({ page, highlight }) => highlight(page.getByText('Help another member', { exact: true }).locator('xpath=../..')),
    },
    {
      say: 'Everything else is peer-to-peer: housing, rides, skills and requests, settled between members.',
      do: async ({ page, highlight }) => highlight(page.getByText('Everything else is peer-to-peer', { exact: true })),
    },
  ],
};
