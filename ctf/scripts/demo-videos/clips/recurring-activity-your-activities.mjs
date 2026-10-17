// Recurring Activity: the list of ongoing activities and what each side can do with one. Points at
// Confirm, Decline and End activity without pressing them, so it makes no writes.
export default {
  slug: 'recurring-activity-your-activities',
  title: 'Recurring Activity: your ongoing activities',
  steps: [
    {
      say: 'Recurring Activity is where you acknowledge something ongoing you share with another member. It is a note to each other, never a bill.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/recurring-activity'));
        await page.getByText('Your ongoing activities', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'This one was recorded by another member, and it names you. It waits until you answer.',
      do: async ({ page, highlight }) => highlight(page.getByText('Waiting for confirmation', { exact: true }).first()),
    },
    {
      say: 'Confirm it if it is true. Decline it if it is not. Only the member it names can do either.',
      do: async ({ button, highlight }) => highlight(button('Confirm')),
    },
    {
      say: 'Once confirmed, it shows as ongoing.',
      do: async ({ page, highlight }) => highlight(page.getByText('Ongoing', { exact: true }).first()),
    },
    {
      say: 'Either of you can end it at any time with End activity.',
      do: async ({ button, highlight }) => highlight(button('End activity')),
    },
  ],
};
