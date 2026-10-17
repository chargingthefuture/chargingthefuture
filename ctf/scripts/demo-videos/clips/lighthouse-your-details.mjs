// LightHouse: the You tab, where a seeker saves what they are looking for. Points at the form and
// the save button without pressing it, so it makes no writes.
export default {
  slug: 'lighthouse-your-details',
  title: 'LightHouse: your housing details',
  steps: [
    {
      say: 'The You tab holds your housing details. You need them saved before you can request a stay.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/lighthouse'));
        await button('You').waitFor({ timeout: 20_000 });
        await button('You').click();
        await page.getByText('Your housing details', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Say what you are looking for, where, when you want to move in, and your budget.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^What you.re looking for$/).first()),
    },
    {
      say: 'Tick this box to show what you are looking for on the Wanted tab, so hosts can find you.',
      do: async ({ page, highlight }) => highlight(page.getByLabel("Show what I'm looking for on the Wanted tab")),
    },
    {
      say: 'Then save. A host sees your details only after you request their place.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: /^Save (changes|your details)$/ }).first()),
    },
  ],
};
