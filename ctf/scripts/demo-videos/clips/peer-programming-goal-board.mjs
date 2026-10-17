// PeerProgramming's goal board, signed in as the demo account. Seed Demo puts the board in the
// state this clip expects: two sample goals with cards in every column.
export default {
  slug: 'peer-programming-goal-board',
  title: 'PeerProgramming: the goal board',
  steps: [
    {
      say: 'This is the goal board in PeerProgramming. Members post goals, and break each one into small cards.',
      speak: 'This is the goal board in Peer Programming. Members post goals, and break each one into small cards.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/peer-programming?tab=goals'));
        // The board only renders for a member of a cohort; waiting on its first column fails here,
        // with a screenshot, rather than three steps later.
        await page.getByText('Up for grabs').first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Up for grabs holds the cards nobody has taken yet. Each one is a small task you can do from your phone.',
      do: async ({ page, highlight }) => highlight(page.getByText('Find three yards hiring near Dallas').first()),
    },
    {
      say: 'Take a card, do it, and post what you found. The goal\'s owner marks whether it helped.',
      do: async ({ page, highlight }) => highlight(page.getByText('Done', { exact: true }).first()),
    },
    {
      say: 'To ask for help with your own goal, press Add your goal.',
      do: async ({ page, highlight }) => highlight(page.getByText('+ Add your goal').first()),
    },
  ],
};
