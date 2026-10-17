// SkillsHunt's Status panel: updates about your nominations, with unread ones marked. Uses the two
// demo entries from demo-seed/30-skills-hunt.mjs. Writes: marks the unread entry as read (a re-run of
// the demo seed makes it unread again).
export default {
  slug: 'skills-hunt-status',
  title: 'SkillsHunt: status updates',
  steps: [
    {
      say: 'The bell at the top opens Status, where SkillsHunt tells you what happened to your nominations.',
      speak: 'The bell at the top opens Status, where Skills Hunt tells you what happened to your nominations.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/skills-hunt'));
        await button('Status').click();
        await page.getByText("You're in the top 10", { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'An update you have not read yet is in bold with a colored edge.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: /You're in the top 10/ })),
    },
    {
      say: 'One you have read is plain, like this one about an accepted nomination.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: /Submission accepted/ })),
    },
    {
      say: 'Tap an unread update to mark it read. There is no count on the bell, so nothing nags you.',
      do: async ({ page, pause }) => {
        await page.getByRole('button', { name: /You're in the top 10/ }).click();
        await pause(1);
      },
    },
  ],
};
