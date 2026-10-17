// SkillUp: the Progress tab, showing the demo account's cohort, its trainer, and where the milestone
// bar goes. The demo enrollment holds no milestone deposits, so the card shows its waiting line
// rather than the bar; the clip matches either. Makes no writes.
const PROGRESS_LINE = /^(Milestones|Enrolled — awaiting cohort start)$/;

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
        await page.getByText(PROGRESS_LINE).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Here is your cohort, and the trainer who runs it.',
      do: async ({ page, highlight }) => highlight(
        page.locator('div')
          .filter({ hasText: 'Career Acceleration — Demo Cohort' })
          .filter({ has: page.getByText(PROGRESS_LINE) })
          .last(),
      ),
    },
    {
      say: 'Once the cohort is underway, a bar here counts the milestones you have finished. Your trainer signs each one off, and your deposit comes back as they do.',
      do: async ({ page, highlight }) => highlight(page.getByText(PROGRESS_LINE).first()),
    },
  ],
};
