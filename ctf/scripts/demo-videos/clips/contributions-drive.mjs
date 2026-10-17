// Contributions' Drive tab: the current fundraiser's goals and how close the community is to each.
// Reads only; no write to the demo data.
export default {
  slug: 'contributions-drive',
  title: 'Contributions: the fundraiser',
  steps: [
    {
      say: 'Contributions is where members help keep the app running. The Drive tab shows the current fundraiser.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/contributions'));
        await page.getByText('Funding raised', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Funding raised is what members have given toward the platform\'s costs, against this drive\'s goal.',
      do: async ({ page, highlight }) => highlight(page.getByText('Funding raised', { exact: true }).locator('xpath=../../..')),
    },
    {
      say: 'Quora comments and GitHub stars count too. Each bar shows how close the community is to that goal.',
      do: async ({ page, highlight }) => highlight(page.getByText('Quora comments', { exact: true }).locator('xpath=../../..')),
    },
    {
      say: 'These are totals for everyone. No names are shown.',
      do: async ({ page, highlight }) => highlight(page.getByText('GitHub stars', { exact: true }).locator('xpath=../../..')),
    },
  ],
};
