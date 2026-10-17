// Trust: the member's own trust card on the account page, and the part other members see.
// Reads only; no write to the demo data.
export default {
  slug: 'trust-your-card',
  title: 'Trust: your trust card',
  steps: [
    {
      say: 'Trust has no screen of its own. Opening it brings you to your account page, where your trust card is.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/trust'));
        await page.getByText('Your trust', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Your trust lists things you have actually done here, each as a plain sentence. There is no score and no badge.',
      do: async ({ page, highlight }) => highlight(page.getByText('Your trust', { exact: true }).locator('xpath=../following-sibling::div[1]')),
    },
    {
      say: 'What members see is the exact list any other member gets about you. Nobody can change it, you included.',
      do: async ({ page, highlight }) => highlight(page.getByText('What members see', { exact: true }).locator('xpath=..')),
    },
    {
      say: 'Trust is earned by taking part. There is nothing to fill in.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Trust is earned by taking part/)),
    },
  ],
};
