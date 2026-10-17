// Account & Data: the services that hold the member's data, and the download and delete controls.
// Points at Download and Delete without pressing either. Reads only.
export default {
  slug: 'account-data-your-data',
  title: 'Account & Data: see, download, and delete your data',
  steps: [
    {
      say: 'Account and Data shows the personal data each part of the app holds for you.',
      do: async ({ page, app }) => {
        await page.goto(app('/account/data'));
        await page.getByRole('button', { name: 'Download your Directory data as JSON' }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Download all my data gives you one file with your own records from every part of the app.',
      do: async ({ button, highlight }) => highlight(button('Download all my data (JSON)')),
    },
    {
      say: 'Each part has its own download button too.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: 'Download your Directory data as JSON' })),
    },
    {
      say: 'The red button deletes that part\'s data. It asks first, and a deletion cannot be undone.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: 'Delete your Directory data' })),
    },
    {
      say: 'Some records are always kept, by design. They are listed here, with a lock.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Always retained/).first()),
    },
    {
      say: 'Danger Zone is where you can delete your entire account. You type a phrase to confirm, so it never happens by accident.',
      do: async ({ page, highlight }) => {
        await page.getByRole('button', { name: /Danger Zone/ }).click();
        await highlight(page.getByRole('button', { name: /Continue to confirmation/ }));
      },
    },
  ],
};
