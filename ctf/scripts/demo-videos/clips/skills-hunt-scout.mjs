// SkillsHunt's Scout tab: the nomination form, filled in part way. Nothing is submitted, because a
// submission checks the Quora link against Quora itself. No write to the demo data.
export default {
  slug: 'skills-hunt-scout',
  title: 'SkillsHunt: nominate a survivor',
  steps: [
    {
      say: 'In SkillsHunt you nominate survivors with skills, so they can be listed in the Directory.',
      speak: 'In Skills Hunt you nominate survivors with skills, so they can be listed in the Directory.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/skills-hunt?tab=scout'));
        await page.getByText('Nominate a Survivor', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Only one round is open at a time. Your nomination goes into this one.',
      do: async ({ page, highlight }) => highlight(page.getByText('Nominating for', { exact: true }).locator('..')),
    },
    {
      say: 'Start with the person\'s Quora profile link. It is required, and it is checked so the same person is not nominated twice.',
      do: async ({ page, highlight }) => highlight(page.locator('#sh-scout-quora')),
    },
    {
      say: 'Add their full name, a short bio and their country.',
      do: async ({ page, highlight }) => {
        const name = page.locator('#sh-scout-fullname');
        await name.click();
        await name.pressSequentially('Amara Williams', { delay: 40 });
        await highlight(name);
      },
    },
    {
      say: 'Then pick their skills from the list. Search finds a skill by name.',
      do: async ({ page, button, highlight }) => {
        const search = page.getByLabel('Search skills by keyword');
        await search.click();
        await search.pressSequentially('Type', { delay: 60 });
        await button('TypeScript').click();
        await highlight(page.getByRole('button', { name: 'Remove TypeScript' }));
      },
    },
    {
      say: 'Submit sends the nomination for review. Points count once it is accepted.',
      do: async ({ button, highlight }) => highlight(button('Submit Nomination · earn points on acceptance')),
    },
  ],
};
