// Workforce: the Community tab, the planning teams, and one team's roster of Directory members.
// Uses the profiles in demo-seed/11-workforce.mjs (Grace Lindqvist in Water & Sanitation). Reads only.
const team = (page) => page.getByRole('button', { name: /^Water & Sanitation/ });

export default {
  slug: 'workforce-community-teams',
  title: 'Workforce: Community planning teams',
  steps: [
    {
      say: 'The Community tab groups people from the Directory into the teams a community would need to run itself.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/workforce?view=community-planning'));
        await team(page).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each team says what it is responsible for, which sectors it draws from, and how many members match.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: /^Legal & Governance/ })),
    },
    {
      say: 'Open a team to see who matches it.',
      do: async ({ page, highlight }) => {
        await team(page).click();
        const name = page.getByRole('link', { name: 'Grace Lindqvist' });
        await name.waitFor({ timeout: 20_000 });
        await highlight(name);
      },
    },
    {
      say: 'Each name opens that person\'s Directory profile. The teams update as the Directory changes.',
      do: async ({ page }) => {
        await page.getByRole('link', { name: 'Grace Lindqvist' }).click();
        await page.getByText('Specializations', { exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
  ],
};
