// Reader: the page that explains the feed reader and links to it. Points at the link without
// opening it, because it leaves the app. Makes no writes.
export default {
  slug: 'reader-open',
  title: 'Reader: what it is',
  steps: [
    {
      say: 'Reader is a feed reader. It collects what sites publish, in the order they published it. Nothing ranks it, and nothing records what you opened.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/reader'));
        await page.getByRole('link', { name: 'Open the reader' }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Open the reader takes you to it. You sign in there with this same account.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: 'Open the reader' })),
    },
    {
      say: 'A new account already follows the blog, the demo videos and the recorded broadcasts. Add anything else you read.',
      do: async ({ page, highlight }) => highlight(page.getByRole('heading', { name: 'What you get' })),
    },
    {
      say: 'It cannot reach back before you start, and it does not notify you. You go and look.',
      do: async ({ page, highlight }) => highlight(page.getByRole('heading', { name: 'What it cannot do' })),
    },
    {
      say: 'A place on it comes from finishing the check or helping with what it costs. Losing a place is not a ban, and your account here is untouched.',
      do: async ({ page, highlight }) => highlight(page.getByRole('heading', { name: 'What a place on it costs' })),
    },
  ],
};
