// Recurring Activity: filling in the form to acknowledge a new ongoing activity. Picks a member and
// fills the fields but does not submit, so it makes no writes.
export default {
  slug: 'recurring-activity-acknowledge',
  title: 'Recurring Activity: acknowledge an activity',
  steps: [
    {
      say: 'To record something new, start at the top of Recurring Activity.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/recurring-activity'));
        await page.getByText('Acknowledge an ongoing activity', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Search for the other member by name, and pick them.',
      do: async ({ page, highlight }) => {
        const search = page.getByLabel('Search members by name');
        await search.click();
        await search.pressSequentially('Alex', { delay: 60 });
        const match = page.getByRole('button', { name: /Alex/ }).first();
        await match.waitFor({ timeout: 20_000 });
        await highlight(match);
      },
    },
    {
      say: 'Choose what it is, the currency, and how often it happens. There is no box for an amount of money.',
      do: async ({ page, button, highlight }) => {
        await page.getByRole('button', { name: /Alex/ }).first().click();
        await button('Choose a different member').waitFor({ timeout: 20_000 });
        await page.locator('#ra-sector').selectOption('service');
        await page.locator('#ra-cadence').selectOption('monthly');
        await highlight(page.locator('#ra-sector'));
      },
    },
    {
      say: 'For ServiceCredits, you can add the value you both agreed on.',
      speak: 'For Service Credits, you can add the value you both agreed on.',
      do: async ({ page, highlight }) => {
        await page.locator('#ra-currency').selectOption('SC');
        const value = page.getByLabel('ServiceCredits value (optional)');
        await value.waitFor({ timeout: 20_000 });
        await value.pressSequentially('20', { delay: 60 });
        await highlight(value);
      },
    },
    {
      say: 'Acknowledge activity sends it to the other member to confirm. It stays private unless you change that.',
      do: async ({ button, highlight }) => highlight(button('Acknowledge activity')),
    },
  ],
};
