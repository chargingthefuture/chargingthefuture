// Foundation's Browse tab: a name search, then a skill filter. Reads only.
export default {
  slug: 'foundation-find-provider',
  title: 'Foundation: find a provider',
  steps: [
    {
      say: 'Foundation is where you find members who offer a skill. Everyone listed here said yes to being contacted.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/foundation'));
        await page.getByText('Alex Rivera', { exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Search by name, headline, or what they wrote about themselves.',
      do: async ({ page, highlight }) => {
        const search = page.getByPlaceholder('Search trade providers…');
        await search.click();
        // One change, not a key at a time: the list reloads on each change and drops later keys.
        await search.fill('Alex');
        await page.getByText('Jordan Kim', { exact: true }).waitFor({ state: 'hidden', timeout: 20_000 });
        await highlight(page.getByText('Alex Rivera', { exact: true }).first());
      },
    },
    {
      say: 'Or tap a skill on any card to see only the people who offer it.',
      do: async ({ page, highlight }) => {
        await page.getByPlaceholder('Search trade providers…').fill('');
        await page.getByText('Jordan Kim', { exact: true }).first().waitFor({ timeout: 20_000 });
        const skill = page.getByRole('button', { name: 'TypeScript', exact: true }).first();
        await skill.click();
        await page.getByText('Jordan Kim', { exact: true }).waitFor({ state: 'hidden', timeout: 20_000 });
        await highlight(page.getByText('Offering:').first());
      },
    },
    {
      say: 'Clear takes the filter off.',
      do: async ({ button, highlight }) => highlight(button('Clear')),
    },
    {
      say: 'Everyone is back on the list.',
      do: async ({ page, button }) => {
        await button('Clear').click();
        await page.getByText('Jordan Kim', { exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
  ],
};
