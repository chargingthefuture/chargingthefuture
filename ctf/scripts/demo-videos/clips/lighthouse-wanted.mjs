// LightHouse: the Wanted tab, where members show what they are looking for. Makes no writes.
export default {
  slug: 'lighthouse-wanted',
  title: 'LightHouse: the Wanted tab',
  steps: [
    {
      say: 'The Wanted tab is the other side: members who are looking for a place.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/lighthouse'));
        await button('Wanted').waitFor({ timeout: 20_000 });
        await button('Wanted').click();
        await page.getByText('People looking for a place', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each person wrote their posting themselves. It shows what they need, where, and their budget, with no name or phone number.',
      do: async ({ page, highlight }) => highlight(page.getByText('People looking for a place', { exact: true })),
    },
    {
      say: 'If you have a place that could fit, List your place takes you to the form.',
      do: async ({ button, highlight }) => highlight(button('List your place')),
    },
  ],
};
