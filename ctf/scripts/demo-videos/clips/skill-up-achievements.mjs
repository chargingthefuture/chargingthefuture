// SkillUp's Achievements tab: badges earned and badges still locked. Uses the three demo badges from
// demo-seed/31-skill-up.mjs, one earned by the demo account. Reads only; no write to the demo data.
export default {
  slug: 'skill-up-achievements',
  title: 'SkillUp: achievements',
  steps: [
    {
      say: 'The Achievements tab shows the badges you can earn in SkillUp.',
      speak: 'The Achievements tab shows the badges you can earn in Skill Up.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/skill-up'));
        await button('Achievements').click();
        await page.getByText('First Milestone', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Earned lists the badges you already have. This one came from finishing a first milestone.',
      do: async ({ page, highlight }) => highlight(page.getByText('First Milestone', { exact: true }).locator('xpath=..')),
    },
    {
      say: 'Locked lists the ones still ahead of you, and what each one asks.',
      do: async ({ page, highlight }) => highlight(page.getByText('Cohort Graduate', { exact: true }).locator('xpath=..')),
    },
    {
      say: 'Some badges come with a thank-you in credits. Badges are only ever given; nothing here takes credits away.',
      do: async ({ page, highlight }) => highlight(page.getByText('SC from achievements', { exact: true }).locator('xpath=../..')),
    },
  ],
};
