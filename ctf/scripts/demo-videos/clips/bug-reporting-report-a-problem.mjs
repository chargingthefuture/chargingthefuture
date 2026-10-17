// Reporting a problem: opens the report form from the top bar, fills it, and closes it with Cancel.
// Never presses Send report, so nothing is stored and no report is filed.
export default {
  slug: 'bug-reporting-report-a-problem',
  title: 'Reporting a problem: the report form',
  steps: [
    {
      say: 'Something in the app not working? Tap the bug button in the top bar.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/'));
        const bug = page.locator('button[aria-label="Report a bug"]:visible').first();
        await bug.waitFor({ timeout: 20_000 });
        await highlight(bug);
      },
    },
    {
      say: 'Choose Report a problem. A small form opens on top of what you were doing, so you keep your place.',
      do: async ({ page, highlight }) => {
        await page.locator('button[aria-label="Report a bug"]:visible').first().click();
        await highlight(page.getByRole('menuitem', { name: 'Report a problem' }));
      },
    },
    {
      say: 'Write one line about what went wrong. That is the only box you have to fill in.',
      do: async ({ page, highlight }) => {
        await page.getByRole('menuitem', { name: 'Report a problem' }).click();
        const box = page.getByLabel('What went wrong?');
        await box.waitFor({ timeout: 20_000 });
        await box.click();
        await box.pressSequentially('The page went blank after I pressed Save.', { delay: 35 });
        await highlight(box);
      },
    },
    {
      say: 'Add what you were trying to do if it helps. The page you were on is attached for you.',
      do: async ({ page, highlight }) => highlight(page.getByLabel('What were you trying to do?')),
    },
    {
      say: 'Send report stores it privately. Reports are one way, so questions go to the Commons, where members can answer.',
      do: async ({ button, highlight }) => highlight(button('Send report')),
    },
    {
      say: 'Cancel closes the form without sending anything.',
      do: async ({ button }) => button('Cancel').click(),
    },
  ],
};
