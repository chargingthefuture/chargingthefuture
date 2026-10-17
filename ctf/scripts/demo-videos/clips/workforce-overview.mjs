// Workforce's Overview tab: the top-line cards and Sector Opportunities. Read only. No write to the
// demo data.
export default {
  slug: 'workforce-overview',
  title: 'Workforce: the overview',
  steps: [
    {
      say: 'Workforce is a live tracker of the skills the community has, sector by sector.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/workforce'));
        await page.getByText('Skills Coverage', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Recruited is the number of people listed in the Directory, with progress toward the goal under it.',
      do: async ({ page, highlight }) => highlight(page.getByText('Recruited', { exact: true }).first().locator('..')),
    },
    {
      say: 'Skills Coverage is how much of the skills list has at least one member behind it.',
      do: async ({ page, highlight }) => highlight(page.getByText('Skills Coverage', { exact: true }).locator('..')),
    },
    {
      say: 'The summary under the cards is speculative. It is a baseline for thinking about scale, not a forecast.',
      do: async ({ page, highlight }) => highlight(page.getByText('Skills Economy Summary', { exact: true }).locator('..')),
    },
    {
      say: 'Sector Opportunities shows each sector\'s recruited count, its goal, and how many places are still to fill.',
      do: async ({ page, highlight }) => highlight(page.getByText('Sector Opportunities', { exact: true })),
    },
  ],
};
