// Directory: opens one member's profile and points at its sections and the Share control. Reads only.
export default {
  slug: 'directory-profile',
  title: 'Directory: read a profile',
  steps: [
    {
      say: 'Tap a card to open that person\'s profile.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/directory'));
        const card = page.getByText('Alex Rivera', { exact: true }).first();
        await card.waitFor({ timeout: 20_000 });
        await card.click();
        await page.getByText('Directory profile', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'About is what they wrote about themselves.',
      do: async ({ page, highlight }) => highlight(page.getByText('About', { exact: true }).first()),
    },
    {
      say: 'Specializations lists the skills they hold.',
      do: async ({ page, highlight }) => highlight(page.getByText('Specializations', { exact: true }).first()),
    },
    {
      say: 'Want a service from this person? Look for them in Foundation, where members offer and exchange help.',
      do: async ({ page, highlight }) => highlight(page.getByText('Want to work together?', { exact: true }).first()),
    },
    {
      say: 'Share gives you a link to this profile. It opens only for people who are signed in.',
      do: async ({ button, highlight }) => highlight(button('Share')),
    },
  ],
};
