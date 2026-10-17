// Directory: the invitations wall as a signed-in member sees it, one invitation opened in full, and
// its link to the person's listing. Uses the three invitations in demo-seed/12-directory.mjs.
// Reads only. The Quora address in the invitation is not opened.
export default {
  slug: 'directory-invitations',
  title: 'Directory: read the invitations',
  steps: [
    {
      say: 'Under your profile button, Read the invitations opens the letters written to people listed in the Directory.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/apps/directory'));
        const link = page.getByRole('link', { name: 'Read the invitations' });
        await link.waitFor({ timeout: 20_000 });
        await highlight(link);
      },
    },
    {
      say: 'Each card shows who it is for, the date, and its opening words. Newest first.',
      do: async ({ page, highlight }) => {
        await page.getByRole('link', { name: 'Read the invitations' }).click();
        const card = page.getByText('An invitation to Rosa Delgado', { exact: true }).first();
        await card.waitFor({ timeout: 20_000 });
        await highlight(card);
      },
    },
    {
      say: 'Read the invitation opens it in full at the top of the page.',
      do: async ({ page, highlight }) => {
        const read = page.getByRole('link', { name: 'Read the invitation to Rosa Delgado' });
        await read.click();
        await page.getByRole('article').first().waitFor({ timeout: 20_000 });
        await highlight(page.getByRole('article').first());
      },
    },
    {
      say: 'See the live listing opens the person\'s profile in the Directory.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: 'See the live listing' })),
    },
    {
      say: 'Here is the listing the invitation is about.',
      do: async ({ page }) => {
        await page.getByRole('link', { name: 'See the live listing' }).click();
        await page.getByText('Specializations', { exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
  ],
};
