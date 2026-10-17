// Contributions' My history tab: the member's own contributions and where each one stands. Seed Demo
// gives the demo account a confirmed Quora comment and a GitHub star waiting for review. Reads only;
// no write to the demo data.
export default {
  slug: 'contributions-history',
  title: 'Contributions: your history',
  steps: [
    {
      say: 'My history lists what you have contributed.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/contributions'));
        await page.getByText('Funding raised', { exact: true }).waitFor({ timeout: 20_000 });
        await button('My history').click();
        await page.getByText('Confirmed', { exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Confirmed means the owner found it, and the ServiceCredits thank-you is in your wallet.',
      speak: 'Confirmed means the owner found it, and the Service Credits thank-you is in your wallet.',
      do: async ({ page, highlight }) => highlight(page.getByText('Confirmed', { exact: true }).first().locator('xpath=../..')),
    },
    {
      say: 'Waiting for review means the owner has not checked it yet.',
      do: async ({ page, highlight }) => highlight(page.getByText('Waiting for review', { exact: true }).first().locator('xpath=../..')),
    },
    {
      say: 'Contributions are private between you and the platform owner. There is no public list of who gave.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Contributions are private between you and the platform owner/)),
    },
  ],
};
