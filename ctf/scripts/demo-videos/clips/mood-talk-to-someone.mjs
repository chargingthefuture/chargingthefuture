// Mood's Talk to someone links, which point to people in the community. Nothing is pressed and
// nothing is written.
export default {
  slug: 'mood-talk-to-someone',
  title: 'Mood: talk to someone',
  steps: [
    {
      say: 'Under the check-in, Mood points you to people in the community.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/mood'));
        await page.getByText('Talk to someone', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'If you are struggling, Talk to someone helps you reach a member with mental-health expertise.',
      do: async ({ page, highlight }) => highlight(page.getByText('Talk to someone', { exact: true })),
    },
    {
      say: 'Find someone in the Directory lets you search members by specialty.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: /Find someone in the Directory/ })),
    },
    {
      say: 'Reach out through Foundation to talk it through with a member who can help.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: /Reach out through Foundation/ })),
    },
    {
      say: 'Your check-ins stay private. The community trends are anonymous and show totals only.',
      do: async ({ page, highlight }) => highlight(page.getByText(/Privacy First/).first().locator('..')),
    },
  ],
};
