// ClickLog: log an incident with a private note. Writes one untagged, private incident with a note
// to the demo schema on every run.
const NOTE = 'Same car parked outside again this morning.';

export default {
  slug: 'click-log-log-incident',
  title: 'ClickLog: log an incident',
  steps: [
    {
      say: 'ClickLog is a private counter for incidents. The top shows how many you have logged.',
      speak: 'Click Log is a private counter for incidents. The top shows how many you have logged.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/apps/click-log'));
        await page.getByText('Recent Incidents', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(page.getByText(/incidents total$/).first());
      },
    },
    {
      say: 'Press Log Incident to open the form.',
      do: async ({ button, highlight }) => highlight(button('Log Incident')),
    },
    {
      say: 'Write what happened, if you want to. Your notes are always private. Nobody but you sees them.',
      do: async ({ page, button, highlight }) => {
        await button('Log Incident').click();
        const box = page.getByPlaceholder('Describe what happened…');
        await box.waitFor({ timeout: 20_000 });
        await box.click();
        await box.pressSequentially(NOTE, { delay: 35 });
        await highlight(box);
      },
    },
    {
      say: 'An incident with no tags stays private unless you tick this box.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Share this incident with the owner/).first()),
    },
    {
      say: 'Press Submit.',
      do: async ({ button, highlight }) => highlight(button('Submit')),
    },
    {
      say: 'The incident is at the top of your list, and your total went up by one.',
      do: async ({ page, button }) => {
        await button('Submit').click();
        await page.getByText(NOTE).first().waitFor({ timeout: 20_000 });
      },
    },
  ],
};
