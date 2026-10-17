// Workforce's What's your 1%? tab: the member's own card and their own arithmetic. The two numbers
// typed stay in the browser; nothing is saved. No write to the demo data.
export default {
  slug: 'workforce-one-percent',
  title: "Workforce: What's your 1%?",
  steps: [
    {
      say: 'The last tab, What\'s your 1%?, is about you alone. Nobody else sees your figures, and you see nobody else\'s.',
      speak: 'The last tab, What\'s your one percent?, is about you alone. Nobody else sees your figures, and you see nobody else\'s.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/workforce?view=one-percent'));
        await page.getByText('Your own numbers', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Your card is made from your Directory listing: your name and the skills on it.',
      do: async ({ page, highlight }) => highlight(page.getByText('Demo Participant', { exact: true }).first().locator('..')),
    },
    {
      say: 'Type what you charge for one job, and how often one person needs you in a year.',
      do: async ({ page, highlight }) => {
        const rate = page.locator('#one-percent-rate');
        await rate.click();
        await rate.pressSequentially('250', { delay: 80 });
        const often = page.locator('#one-percent-frequency');
        await often.click();
        await often.pressSequentially('0.5', { delay: 80 });
        await highlight(often);
      },
    },
    {
      say: 'The screen works out what that means across your 1%. Nothing here is saved or sent anywhere.',
      speak: 'The screen works out what that means across your one percent. Nothing here is saved or sent anywhere.',
      do: async ({ page, highlight }) => highlight(page.locator('[aria-live="polite"]').first()),
    },
    {
      say: 'These figures are speculative. They are not a forecast of what anybody will earn.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^These figures are speculative/)),
    },
  ],
};
