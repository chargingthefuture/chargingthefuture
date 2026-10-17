// Skills Taxonomy: stepping from a sector to a job title to its skills, then searching the skills.
// Read only. No write to the demo data.
export default {
  slug: 'skills-taxonomy-browse',
  title: 'Skills Taxonomy: browse sectors, job titles and skills',
  steps: [
    {
      say: 'Skills Taxonomy is the shared list of work sectors, job titles and skills the app uses.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/skills-taxonomy'));
        await page.getByText(/^Sectors \(\d+\)$/).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'It starts with sectors. Each one says how many job titles it holds.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: /^Technology/ })),
    },
    {
      say: 'Open a sector to see its job titles.',
      do: async ({ page, highlight }) => {
        await page.getByRole('button', { name: /^Technology/ }).click();
        await highlight(page.getByRole('button', { name: /^Platform Engineer/ }));
      },
    },
    {
      say: 'Open a job title to see its skills.',
      do: async ({ page, highlight }) => {
        await page.getByRole('button', { name: /^Platform Engineer/ }).click();
        await page.getByText('TypeScript', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(page.getByText('TypeScript', { exact: true }));
      },
    },
    {
      say: 'Search narrows the skills in this job title as you type.',
      do: async ({ page, highlight }) => {
        const search = page.getByPlaceholder('Search skills in this role…');
        await search.click();
        await search.pressSequentially('Postgre', { delay: 60 });
        await page.getByText('TypeScript', { exact: true }).waitFor({ state: 'detached', timeout: 20_000 });
        await highlight(search);
      },
    },
    {
      say: 'The back bar steps up a level.',
      do: async ({ button, highlight }) => highlight(button('Job titles')),
    },
  ],
};
