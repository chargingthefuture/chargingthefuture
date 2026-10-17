// SkillUp: the Progress tab, showing the demo account's cohort and its milestones. Makes no writes.
export default {
  slug: 'skill-up-progress',
  title: 'SkillUp: your progress',
  steps: [
    {
      say: 'The Progress tab follows each cohort you are in.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/skill-up'));
        await button('Progress').waitFor({ timeout: 20_000 });
        await button('Progress').click();
        await page.getByText('Milestones', { exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Here is your cohort.',
      do: async ({ page, highlight }) => highlight(page.getByText('Career Acceleration — Demo Cohort').last()),
    },
    {
      say: 'The bar shows how many milestones you have finished. Your trainer signs each one off, and your deposit comes back as they do.',
      do: async ({ page, highlight }) => highlight(page.getByText('Milestones', { exact: true }).first()),
    },
  ],
};
