// ClickLog: picking a problem tag, and what a tag changes. Opens the form, picks a tag, then
// cancels. No write to the demo data.
export default {
  slug: 'click-log-tags',
  title: 'ClickLog: tag an incident',
  steps: [
    {
      say: 'Tags say which problem happened and which scheme was used. Both are optional.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/click-log'));
        await page.getByText('Recent Incidents', { exact: true }).waitFor({ timeout: 20_000 });
        await button('Log Incident').click();
        await page.getByLabel('Search problems…').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Type a word to find a problem, then pick it.',
      do: async ({ page, button, highlight }) => {
        await page.getByLabel('Search problems…').pressSequentially('mail', { delay: 60 });
        await button('Mail lost / tampered with').click();
        await highlight(page.getByText('Mail lost / tampered with', { exact: true }).first());
      },
    },
    {
      say: 'A tagged incident is always shared with the owner. Only the date, a rough area and the tags are sent, never your note.',
      do: async ({ page, highlight }) => highlight(page.getByText(/required for tagged incidents/).first()),
    },
    {
      say: 'Tags also need a location. Submit waits until you press Add location.',
      do: async ({ button, highlight }) => highlight(button('Add location')),
    },
    {
      say: 'Cancel clears the form, and nothing is logged.',
      do: async ({ button }) => {
        await button('Cancel').click();
        await button('Log Incident').waitFor({ timeout: 20_000 });
      },
    },
  ],
};
