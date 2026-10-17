// Skills Taxonomy: the Health sector's job titles, and one skill name listed under more than one of
// them. Uses the sectors in demo-seed/10-skills-taxonomy.mjs. Reads only.
export default {
  slug: 'skills-taxonomy-shared-skill',
  title: 'Skills Taxonomy: one skill under several job titles',
  steps: [
    {
      say: 'Open a sector, here Health, to see its job titles.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/apps/skills-taxonomy'));
        const health = page.getByRole('button', { name: /^Health/ });
        await health.waitFor({ timeout: 20_000 });
        await health.click();
        await highlight(page.getByRole('button', { name: /^Home Health Aides/ }));
      },
    },
    {
      say: 'Home Health Aides lists Crisis intervention among its skills.',
      do: async ({ page, highlight }) => {
        await page.getByRole('button', { name: /^Home Health Aides/ }).click();
        await page.getByText('Crisis intervention', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(page.getByText('Crisis intervention', { exact: true }));
      },
    },
    {
      say: 'Peer Support Specialists lists it too. The same skill can belong to more than one job title.',
      do: async ({ page, button, highlight }) => {
        await button('Job titles').click();
        await page.getByRole('button', { name: /^Peer Support Specialists/ }).click();
        await page.getByText('Active listening', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(page.getByText('Crisis intervention', { exact: true }));
      },
    },
    {
      say: 'Workforce matches skills by name, so a person who holds it counts under each of those job titles.',
      do: async ({ page, highlight }) => highlight(page.getByText('Crisis intervention', { exact: true })),
    },
  ],
};
