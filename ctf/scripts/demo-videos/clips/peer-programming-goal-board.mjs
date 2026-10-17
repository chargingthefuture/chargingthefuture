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
        await page.waitForLoadState('networkidle');
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
