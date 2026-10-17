// The "How it's earned" page for the Weavers of the Commons badge on Directory profiles. Reads only.
export default {
  slug: 'contributor-access-weavers-explainer',
  title: 'Directory: how the Weavers of the Commons badge is earned',
  steps: [
    {
      say: 'Weavers of the Commons is a badge on Directory profiles, for members who steadily deliver real help to other members.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/directory/weavers-of-the-commons'));
        await page.getByText('How it is earned', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'It is earned by helping. There is no application, and no way to buy it. Anyone can earn it.',
      do: async ({ page, highlight }) => highlight(page.getByText('How it is earned', { exact: true })),
    },
    {
      say: 'No score, points, or ranking is shown anywhere.',
      do: async ({ page, highlight }) => highlight(page.getByText('No scores, no rankings', { exact: true })),
    },
    {
      say: 'Once earned, the badge stays. It is never removed for going quiet or taking a break.',
      do: async ({ page, highlight }) => highlight(page.getByText('It is permanent', { exact: true })),
    },
    {
      say: 'It also lets you suggest a new scheme name in ClickLog while you log an incident.',
      speak: 'It also lets you suggest a new scheme name in Click Log while you log an incident.',
      do: async ({ page, highlight }) => highlight(page.getByText('What it opens', { exact: true })),
    },
  ],
};
