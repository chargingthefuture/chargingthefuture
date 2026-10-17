// Contributions' Contribute tab: the three ways to help, and the gift card form. Submit is
// highlighted, never pressed, because a gift card claim concerns a real-money gift. No write to the
// demo data.
export default {
  slug: 'contributions-ways-to-help',
  title: 'Contributions: ways to help',
  steps: [
    {
      say: 'Open the Contribute tab to see the ways you can help.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/contributions'));
        await page.getByText('Funding raised', { exact: true }).waitFor({ timeout: 20_000 });
        await button('Contribute').click();
        await page.getByText('How would you like to help?', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'There are three: a gift card, a comment on a Quora post, or a star on GitHub. Each one is thanked with ServiceCredits.',
      speak: 'There are three: a gift card, a comment on a Quora post, or a star on GitHub. Each one is thanked with Service Credits.',
      do: async ({ page, highlight }) => highlight(page.getByText('How would you like to help?', { exact: true })),
    },
    {
      say: 'Choose Gift card, and its form opens below.',
      do: async ({ page }) => {
        await page.getByRole('button', { name: /^Gift card/ }).first().click();
        await page.getByText('Gift card details', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Never post a gift card code in the Commons. It is a public chat, and a code shared there is lost.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Never post your gift card code or details in the Commons/)),
    },
    {
      say: 'Submit records the card type and value. You then send the card itself to the platform owner privately, on Signal.',
      do: async ({ button, highlight }) => highlight(button('Submit')),
    },
  ],
};
