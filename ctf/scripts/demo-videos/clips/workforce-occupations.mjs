// Workforce's Occupations tab: the list and one occupation's detail. Read only. No write to the
// demo data.
const firstRow = (page) => page.getByRole('button', { name: /(to fill|filled)$/ }).first();

export default {
  slug: 'workforce-occupations',
  title: 'Workforce: occupations',
  steps: [
    {
      say: 'The Occupations tab lists occupations with the most roles to fill first.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/workforce?view=occupations'));
        await firstRow(page).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Search and the two filters narrow the list by name, sector and skill level.',
      do: async ({ page, highlight }) => highlight(page.getByPlaceholder('Search occupations…')),
    },
    {
      say: 'Tap an occupation for its details.',
      do: async ({ page, highlight }) => highlight(firstRow(page)),
    },
    {
      say: 'It shows the headcount goal, the yearly training goal, how many people match it, and the roles still to fill.',
      do: async ({ page, highlight }) => {
        await firstRow(page).click();
        await page.getByText('Roles to fill', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(page.getByText('Roles to fill', { exact: true }).locator('..'));
      },
    },
    {
      say: 'A plain note under the numbers explains how each one is worked out.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^How these are computed/)),
    },
    {
      say: 'Back to occupations returns to the list.',
      do: async ({ button, highlight }) => highlight(button('Back to occupations')),
    },
  ],
};
