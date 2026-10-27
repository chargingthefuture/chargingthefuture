// SkillsHunt's Status panel: updates about your nominations, with unread ones marked. Uses the demo
// entry from demo-seed/30-skills-hunt.mjs. Writes: marks it as read (a re-run of the demo seed makes
// it unread again).
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
        await page.getByText("Submission accepted", { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'An update you have not read yet is in bold with a colored edge.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: /Submission accepted/ })),
    },
    {
      say: 'Tap an unread update to mark it read, and it turns plain. There is no count on the bell, so nothing nags you.',
      do: async ({ page, pause }) => {
        await page.getByRole('button', { name: /Submission accepted/ }).click();
        await pause(1);
      },
    },
  ],
};
