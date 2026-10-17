// SkillUp's Trainers tab: the people who lead cohorts. Uses the demo trainer listing from
// demo-seed/31-skill-up.mjs. Reads only; no write to the demo data.
export default {
  slug: 'skill-up-trainers',
  title: 'SkillUp: trainers',
  steps: [
    {
      say: 'The Trainers tab lists the people who lead SkillUp cohorts.',
      speak: 'The Trainers tab lists the people who lead Skill Up cohorts.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/skill-up'));
        await button('Trainers').click();
        await page.getByText('Dana Brooks', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'At the top: how many trainers there are, how many tracks they cover, and how many cohorts are running.',
      do: async ({ page, highlight }) => highlight(page.getByText('Tracks covered', { exact: true }).locator('xpath=../../..')),
    },
    {
      say: 'Each card gives the trainer’s name, what they do, and the tracks they teach.',
      do: async ({ page, highlight }) => highlight(page.getByText('Career coach and portfolio reviewer', { exact: true }).locator('xpath=../../..')),
    },
  ],
};
