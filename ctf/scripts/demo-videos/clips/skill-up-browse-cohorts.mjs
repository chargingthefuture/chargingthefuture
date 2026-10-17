// SkillUp: browsing the training cohorts and opening a card's details. Seed Demo enrolls the demo
// account in the demo cohort, so its card reads Enrolled. Makes no writes.
export default {
  slug: 'skill-up-browse-cohorts',
  title: 'SkillUp: browse cohorts',
  steps: [
    {
      say: 'SkillUp is skills training in small groups called cohorts, each with a trainer.',
      speak: 'Skill Up is skills training in small groups called cohorts, each with a trainer.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/skill-up'));
        await page.getByText('Career Acceleration — Demo Cohort').first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each card shows the cohort, who teaches it, how many milestones it has, and the seats left.',
      do: async ({ page, highlight }) => highlight(page.getByText('Career Acceleration — Demo Cohort').first()),
    },
    {
      say: 'To join, you put down a deposit in credits. It is held, and it comes back to you as you finish each milestone.',
      do: async ({ page, highlight }) => highlight(page.getByText('Returnable deposit', { exact: true }).first()),
    },
    {
      say: 'Details opens the rest, including the language the sessions are held in.',
      do: async ({ page, button, highlight }) => {
        await button('Details').first().click();
        const note = page.getByText(/Sessions are held in English by default/).first();
        await note.waitFor({ timeout: 20_000 });
        await highlight(note);
      },
    },
    {
      say: 'Enroll joins a cohort. Once you are in, the button says so.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: /^(✓ Enrolled|Enroll)$/ }).first()),
    },
  ],
};
