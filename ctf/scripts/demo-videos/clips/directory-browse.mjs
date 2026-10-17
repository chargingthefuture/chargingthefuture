// Directory's browse view: the list, a skill search and a location search. Reads only.
export default {
  slug: 'directory-browse',
  title: 'Directory: find members by skill or place',
  steps: [
    {
      say: 'Directory is a list of members and the skills they have. You do not need a profile of your own to read it.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/directory'));
        await page.getByText('Alex Rivera', { exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each card shows a name, a sector, and some of the skills that person holds.',
      do: async ({ page, highlight }) => highlight(page.getByText('Alex Rivera', { exact: true }).first()),
    },
    {
      say: 'Search by skill. Type TypeScript, and only the people who hold it stay on the list.',
      do: async ({ page, highlight }) => {
        const search = page.getByPlaceholder('Search name, skill, or location…');
        await search.click();
        await search.pressSequentially('TypeScript', { delay: 60 });
        await page.getByText('Jordan Kim', { exact: true }).waitFor({ state: 'hidden', timeout: 20_000 });
        await highlight(search);
      },
    },
    {
      say: 'The same box finds people by place. Type a country, and you see who lives there.',
      do: async ({ page }) => {
        const search = page.getByPlaceholder('Search name, skill, or location…');
        await search.fill('');
        await search.pressSequentially('Canada', { delay: 60 });
        await page.getByText('Alex Rivera', { exact: true }).waitFor({ state: 'hidden', timeout: 20_000 });
        await page.getByText('Jordan Kim', { exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Directory is for reading and finding people. Asking someone for help happens in Foundation.',
      do: async ({ page, highlight }) => highlight(page.getByText('Jordan Kim', { exact: true }).first()),
    },
  ],
};
