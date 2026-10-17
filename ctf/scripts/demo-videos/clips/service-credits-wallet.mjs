// ServiceCredits' Wallet tab: balance, held credits, the community-credit line and recent
// transactions, then a refresh. Reads only; no write to the demo data.
export default {
  slug: 'service-credits-wallet',
  title: 'ServiceCredits: your wallet',
  steps: [
    {
      say: 'This is ServiceCredits. The Wallet tab shows the credits you hold. Credits are not money and cannot be cashed out.',
      speak: 'This is Service Credits. The Wallet tab shows the credits you hold. Credits are not money and cannot be cashed out.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/service-credits'));
        await page.getByText('Your Balance', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Available is what you can send now. In Escrow is held and not yet released. Total is both together.',
      do: async ({ page, highlight }) => highlight(page.getByText('In Escrow', { exact: true }).locator('xpath=../..')),
    },
    {
      say: 'This line says how far below zero a send can take you, if at all.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Community credit/).first()),
    },
    {
      say: 'Recent Transactions lists what came in and went out, newest first, ten to a page.',
      do: async ({ page, highlight }) => highlight(page.getByText('Recent Transactions', { exact: true }).locator('xpath=..')),
    },
    {
      say: 'Refresh reads your wallet again without leaving the screen.',
      do: async ({ button, highlight }) => {
        await highlight(button('Refresh'));
        await button('Refresh').click();
      },
    },
  ],
};
