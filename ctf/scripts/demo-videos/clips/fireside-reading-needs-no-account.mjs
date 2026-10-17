// Fireside's signed-out page at /apps/fireside: what Fireside is, with no account. Writes nothing.
export default {
  slug: 'fireside-reading-needs-no-account',
  title: 'Fireside: reading needs no account',
  signIn: false,
  steps: [
    {
      say: 'Fireside is the conversation under every post on the blog. Reading it needs no account.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/fireside'));
        await page.getByText('Open to read, no account').first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Read the conversation opens the blog, where each post carries its own thread.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: /Read the conversation/ }).first()),
    },
    {
      say: 'Nothing is ranked. Comments run oldest first and stay there, even when somebody agrees with one.',
      do: async ({ page, highlight }) => highlight(page.getByText('Nothing is ranked', { exact: true }).first()),
    },
    {
      say: 'The posts and the conversation under them live on a site this project runs, and the Internet Archive captures it.',
      do: async ({ page, highlight }) => highlight(page.getByText('It is still there in a year', { exact: true }).first()),
    },
  ],
};
