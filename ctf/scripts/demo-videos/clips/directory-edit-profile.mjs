// Directory: opens the member's own profile editor, points at its fields, and closes it without
// saving. Reads only.
export default {
  slug: 'directory-edit-profile',
  title: 'Directory: edit your own profile',
  steps: [
    {
      say: 'Edit my profile opens your own listing.',
      do: async ({ page, app, button, highlight }) => {
        await page.goto(app('/apps/directory'));
        await page.getByText('Alex Rivera', { exact: true }).first().waitFor({ timeout: 20_000 });
        await highlight(button('Edit my profile'));
      },
    },
    {
      say: 'Your name, a short headline, and a few lines about your work.',
      do: async ({ page, button, highlight }) => {
        await button('Edit my profile').click();
        const headline = page.getByLabel('Headline', { exact: true });
        await headline.waitFor({ timeout: 20_000 });
        await highlight(headline);
      },
    },
    {
      say: 'Search for your skills and pick them from the list. At least one skill is needed to save.',
      do: async ({ page, highlight }) => highlight(page.getByLabel('Search skills by keyword')),
    },
    {
      say: 'Save changes puts your edits on your listing. You can change it again at any time.',
      do: async ({ button, highlight }) => highlight(button('Save changes')),
    },
    {
      say: 'Close leaves without changing anything.',
      do: async ({ page }) => {
        await page.getByRole('dialog', { name: 'Edit your directory profile' }).getByRole('button', { name: 'Close', exact: true }).first().click();
        await page.getByRole('dialog', { name: 'Edit your directory profile' }).waitFor({ state: 'hidden', timeout: 20_000 });
      },
    },
  ],
};
