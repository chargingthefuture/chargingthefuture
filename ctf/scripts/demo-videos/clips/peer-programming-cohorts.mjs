// PeerProgramming's Cohorts tab, signed in as the demo account.
export default {
  slug: 'peer-programming-cohorts',
  title: 'PeerProgramming: your cohort',
  steps: [
    {
      say: 'The Cohorts tab shows the group you are in.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/peer-programming'));
        await button('Cohorts').click();
        await button('Join Session').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Your cohort\'s card says how many members it has.',
      speak: 'Your cohort\'s card says how many members it has.',
      do: async ({ page, highlight }) => highlight(page.getByText(/\d+ members?/).first()),
    },
    {
      say: 'These are the people in your cohort.',
      do: async ({ page, highlight }) => highlight(page.getByText('In this cohort', { exact: true }).first()),
    },
    {
      say: 'Join Session opens your cohort\'s live video room.',
      do: async ({ button, highlight }) => highlight(button('Join Session')),
    },
  ],
};
