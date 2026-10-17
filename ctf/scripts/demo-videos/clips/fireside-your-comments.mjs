// Fireside's own screen in the app: the member's comment list, the blog link and search. Writes
// nothing; the search only reads.
export default {
  slug: 'fireside-your-comments',
  title: 'Fireside: your comments',
  steps: [
    {
      say: 'Fireside is the conversation under each post on the blog. In the app, this screen is your side of it.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/fireside'));
        // Either the list's range line or the empty state, so a failed load stops here.
        await page
          .getByText(/You have not written anything here yet|Showing \d+–\d+ of \d+/)
          .first()
          .waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Everything you write shows up here, each one labeled live, held, removed, or withdrawn.',
      do: async ({ page, highlight }) =>
        highlight(page.getByText(/You have not written anything here yet|Showing \d+–\d+ of \d+/).first()),
    },
    {
      say: 'Open the blog takes you to the posts, where the conversations are.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: 'Open the blog' }).first()),
    },
    {
      say: 'Search the conversation for a word or a phrase. Quoted words stay together, and a minus sign leaves one out.',
      do: async ({ page, highlight }) => {
        const box = page.getByPlaceholder('A word or a phrase');
        await box.click();
        await box.pressSequentially('page', { delay: 60 });
        await highlight(box);
      },
    },
    {
      say: 'Each result shows who wrote it and the post it is under. Press the post title to open that conversation.',
      do: async ({ page, button }) => {
        await button('Search').click();
        await page.getByText('Searching…').waitFor({ state: 'hidden', timeout: 20_000 });
      },
    },
  ],
};
