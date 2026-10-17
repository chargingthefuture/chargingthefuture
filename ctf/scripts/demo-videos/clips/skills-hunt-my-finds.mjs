// SkillsHunt's My Finds tab: your own totals and nominations, read only. No write to the demo data.
export default {
  slug: 'skills-hunt-my-finds',
  title: 'SkillsHunt: your finds',
  steps: [
    {
      say: 'My Finds shows the people you have nominated.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/skills-hunt'));
        await button('My Finds').click();
        await page.getByText('Demo Participant', { exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Your totals cover every round. Only you can see them.',
      do: async ({ page, highlight }) => highlight(page.getByText('Your totals, all rounds', { exact: true }).locator('..')),
    },
    {
      say: 'Each nomination shows the person\'s name, their skills, and whether it is pending, accepted or rejected.',
      do: async ({ page, highlight }) => highlight(page.getByText('✓ Accepted', { exact: true }).first()),
    },
  ],
};
