// Fireside's own screen: one of the member's comments, the box that asks for it to be published with
// the post, and Take it down. Uses the seeded comment under the blog's Dictionary post
// (demo-seed/21-fireside.mjs). Writes nothing: the request box and Take it down are pointed at, never
// pressed.
const MINE = 'I keep this page open when I write to somebody new. The plain definitions save a lot of back and forth.';

function row(page) {
  return page
    .locator('div')
    .filter({ has: page.getByText(MINE, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Take it down', exact: true }) })
    .last();
}

export default {
  slug: 'fireside-your-comment-and-the-blog',
  title: 'Fireside: your comment and the blog',
  steps: [
    {
      say: 'On the Fireside screen, each comment you wrote shows with the post it is under. Live means others can read it.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/apps/fireside'));
        await page.getByText(MINE, { exact: true }).waitFor({ timeout: 20_000 });
        await row(page).scrollIntoViewIfNeeded();
        await highlight(row(page).getByText('Live', { exact: true }));
      },
    },
    {
      say: 'This box asks for the comment to be published with the post on the blog. It is off until you turn it on.',
      do: async ({ page, highlight }) => highlight(row(page).getByText('Ask for this to be published with the post', { exact: true })),
    },
    {
      say: 'Turning it on only asks. An admin reads it first. Once published, it is searchable and archived, and nobody can take it back.',
      do: async ({ page, highlight }) => highlight(row(page).getByLabel('Ask for this to be published with the post')),
    },
    {
      say: 'Take it down removes your words from the conversation. It asks first, because nobody can put them back. A reply under it stays.',
      do: async ({ page, highlight }) => highlight(row(page).getByRole('button', { name: 'Take it down', exact: true })),
    },
    {
      say: 'Press the post title to open the conversation.',
      do: async ({ page }) => {
        await row(page).getByRole('button', { name: 'Dictionary: Skills Economy Terms', exact: true }).click();
        await page.getByRole('button', { name: 'Reply', exact: true }).first().waitFor({ timeout: 20_000 });
      },
    },
  ],
};
