// ServiceCredits: community credit, the line that lets a member send a little below zero. Uses the
// 20-credit line from demo-seed/32-service-credits.mjs. Picks the option in the send form but never
// presses Send Credits. No write to the demo data.
export default {
  slug: 'service-credits-community-credit',
  title: 'ServiceCredits: community credit',
  steps: [
    {
      say: 'Some members have a community credit line. The Wallet tab says how far below zero you can go.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/service-credits'));
        await page.getByText(/^Community credit: you can send down to/).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Here the line is 20 credits. You can send down to minus 20, then repay as you earn.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Community credit: you can send down to/).first()),
    },
    {
      say: 'To use it, open Send.',
      do: async ({ page, button }) => {
        await button('Send').click();
        await page.getByLabel('Send method').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Pick Mutual Credit under Send with. The same sentence shows under it, so you know the limit before you send.',
      do: async ({ page, highlight }) => {
        await page.getByLabel('Send method').selectOption('mutual_credit');
        await highlight(page.getByText(/^Community credit: you can send down to/).first());
      },
    },
    {
      say: 'A send can never take you past your line. Credits are not money.',
      do: async ({ button, highlight }) => highlight(button('Send Credits')),
    },
  ],
};
