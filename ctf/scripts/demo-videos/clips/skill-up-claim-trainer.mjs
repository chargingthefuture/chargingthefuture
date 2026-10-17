// SkillUp: claiming a cohort that has no trainer yet, from the Browse tab. Uses the trainerless
// cohort from demo-seed/31-skill-up.mjs, which the demo account can claim because its Directory
// profile lists a skill for that occupation. Writes: makes the demo account that cohort's trainer
// (a re-run of the demo seed hands it back).
export default {
  slug: 'skill-up-claim-trainer',
  title: 'SkillUp: claim a cohort as its trainer',
  steps: [
    {
      say: 'Some cohorts are open but have nobody to teach them yet.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/skill-up'));
        await page.getByText('Platform Engineering Foundations', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'The card says so, right on the front.',
      do: async ({ page, highlight }) => highlight(page.getByText('Nobody is scheduled to teach this one yet.', { exact: true })),
    },
    {
      say: 'Claim as trainer works when your Directory profile lists a skill for this cohort’s job. No admin has to approve it. If no skill matches, the card says what to add.',
      do: async ({ button, highlight }) => highlight(button('Claim as trainer')),
    },
    {
      say: 'Press it, and the cohort is yours to teach. The list reloads, and the cohort no longer asks for a trainer.',
      do: async ({ page, button }) => {
        await button('Claim as trainer').click();
        await button('Claim as trainer').waitFor({ state: 'detached', timeout: 20_000 });
        await page.getByText('Platform Engineering Foundations', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
  ],
};
