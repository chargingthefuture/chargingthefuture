// Mood's weekly check-in form: picks a mood and writes a note, then points at Submit Privately
// without pressing it. Makes no write to the demo data, so the account stays eligible for the next run.
export default {
  slug: 'mood-check-in',
  title: 'Mood: your weekly check-in',
  steps: [
    {
      say: 'Mood is a check-in on how you are doing, once a week.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/mood'));
        await page.getByText('How are you feeling right now?', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Pick how you feel right now, from Struggling to Great.',
      do: async ({ page, highlight }) => {
        const good = page.getByRole('button', { name: /Good$/ }).first();
        await good.click();
        await highlight(good);
      },
    },
    {
      say: 'You can add a note if you want to.',
      do: async ({ page, highlight }) => {
        const note = page.getByPlaceholder(/Anything you'd like to add/);
        await note.click();
        await note.pressSequentially('Slept better this week.', { delay: 35 });
        await highlight(note);
      },
    },
    {
      say: 'Submit Privately saves it under a random ID kept apart from your account. Nobody sees your check-in or your note, not another member and not an admin.',
      do: async ({ button, highlight }) => highlight(button('Submit Privately')),
    },
    {
      say: 'After you submit, you can check in again in seven days.',
      do: async ({ page, highlight }) => highlight(page.getByText(/One check-in per week/).first()),
    },
  ],
};
