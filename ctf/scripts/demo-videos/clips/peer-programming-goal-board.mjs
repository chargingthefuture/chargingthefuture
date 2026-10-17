// PeerProgramming's goal board, signed in as the demo account.
export default {
  slug: 'peer-programming-goal-board',
  title: 'PeerProgramming: the goal board',
  steps: [
    {
      say: 'This is the goal board in PeerProgramming. Each card is one small task toward somebody else\'s goal.',
      speak: 'This is the goal board in Peer Programming. Each card is one small task toward somebody else\'s goal.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/peer-programming?tab=goals'));
        // The board only renders for a member of a cohort; waiting on its first column fails here,
        // with a screenshot, rather than three steps later.
        await page.getByText('Up for grabs').first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Cards sit in three columns: Up for grabs, Doing, and Done.',
      do: async ({ pause }) => pause(0.5),
    },
    {
      say: 'Pick any card, do it from your phone, and post what you found. The goal\'s owner marks whether it helped.',
      do: async ({ scroll }) => scroll(300),
    },
    {
      say: 'To ask for help with your own goal, press Add your goal and break it into small cards.',
      do: async ({ page, scroll }) => {
        await scroll(-300);
        await page.getByText('+ Add your goal').first().click();
      },
    },
  ],
};
