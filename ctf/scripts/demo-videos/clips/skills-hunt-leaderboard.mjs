// SkillsHunt's Leaderboard tab, read only. No write to the demo data.
export default {
  slug: 'skills-hunt-leaderboard',
  title: 'SkillsHunt: the leaderboard',
  steps: [
    {
      say: 'The Leaderboard tab ranks scouts in the open round.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/skills-hunt'));
        await button('Leaderboard').click();
        await page.getByText(/\d+ pts$/).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Scouts are ranked by points from accepted nominations.',
      do: async ({ page, highlight }) => highlight(page.getByText(/\d+ pts$/).first()),
    },
    {
      say: 'Each row says how many of their nominations were accepted.',
      do: async ({ page, highlight }) => highlight(page.getByText(/\d+ accepted · /).first()),
    },
    {
      say: 'Pending points turn into accepted points after review.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Pending points/).first()),
    },
  ],
};
