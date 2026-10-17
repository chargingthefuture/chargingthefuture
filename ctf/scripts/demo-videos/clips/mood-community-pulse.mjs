// Mood's Community tab: the anonymous seven-day pulse. Reads the synthetic check-ins from
// demo-seed/22-mood.mjs, which put enough in the window for the chart to show. Writes nothing.
export default {
  slug: 'mood-community-pulse',
  title: 'Mood: the community pulse',
  steps: [
    {
      say: 'Mood also shows how members are doing this week, all together.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/apps/mood'));
        await page.getByText('How are you feeling right now?', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(page.getByRole('button', { name: /^Community( Pulse)?$/ }).first());
      },
    },
    {
      say: 'The top shows the average mood over seven days and how many check-ins there were. No names, no notes, and no single check-in.',
      do: async ({ page, highlight }) => {
        await page.getByRole('button', { name: /^Community( Pulse)?$/ }).first().click();
        await page.getByText('Community Wellness Trends', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(page.getByText('Check-ins this week', { exact: true }));
      },
    },
    {
      say: 'Each day gets a bar with its average mood.',
      do: async ({ page, highlight }) => {
        const chart = page.getByText('7-Day Community Mood', { exact: true });
        await chart.scrollIntoViewIfNeeded();
        await highlight(chart);
      },
    },
    {
      say: 'A day with fewer than three check-ins shows no average, so nobody\'s mood can be picked out.',
      do: async ({ page, highlight }) => {
        const note = page.getByText(/A day with fewer than 3 check-ins shows no average/);
        await note.scrollIntoViewIfNeeded();
        await highlight(note);
      },
    },
  ],
};
