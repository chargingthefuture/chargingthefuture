// Recurring Activity: changing who can see an activity you recorded. Sets the demo account's active
// activity to Members only, then back to Private, so the demo data ends as it started.
export default {
  slug: 'recurring-activity-visibility',
  title: 'Recurring Activity: who can see it',
  steps: [
    {
      say: 'An activity you recorded is private to begin with.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/recurring-activity'));
        await page.getByLabel('Who can see this activity').first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Visible to sets who can see it: private, members only, or public.',
      do: async ({ page, highlight }) => highlight(page.getByLabel('Who can see this activity').first()),
    },
    {
      say: 'Pick members only, and it saves straight away.',
      do: async ({ page, highlight }) => {
        const select = page.getByLabel('Who can see this activity').first();
        await select.selectOption('restricted');
        await page.waitForFunction(() => {
          const el = document.querySelector('select[aria-label="Who can see this activity"]');
          return el && !el.disabled && el.value === 'restricted';
        }, null, { timeout: 20_000 });
        await highlight(select);
      },
    },
    {
      say: 'Change it back whenever you like. Only the member who recorded it can change this.',
      do: async ({ page }) => {
        const select = page.getByLabel('Who can see this activity').first();
        await select.selectOption('private');
        await page.waitForFunction(() => {
          const el = document.querySelector('select[aria-label="Who can see this activity"]');
          return el && !el.disabled && el.value === 'private';
        }, null, { timeout: 20_000 });
      },
    },
  ],
};
