// Contributions: the GitHub star way to help is grayed out once your star has been thanked. Uses
// the confirmed star from demo-seed/33-contributions.mjs. Reads only; no write to the demo data.
export default {
  slug: 'contributions-star-credited',
  title: 'Contributions: a star is thanked once',
  steps: [
    {
      say: 'Open the Contribute tab.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/contributions'));
        await page.getByText('Funding raised', { exact: true }).waitFor({ timeout: 20_000 });
        await button('Contribute').click();
        await page.getByText('How would you like to help?', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'A star on GitHub is thanked once per person. This account has already been thanked, so the star is grayed out.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^You've already received credits for starring the repository/).locator('xpath=..')),
    },
    {
      say: 'The gift card and the Quora comment stay open. Quora comments can be thanked more than once.',
      do: async ({ page, highlight }) => highlight(page.getByText('Comment on a Quora post', { exact: true }).locator('xpath=..')),
    },
  ],
};
