// Commons: reacts to another member's post with a thumbs-up, then takes the reaction off again. Uses
// the seeded post by @dan_whitaker (demo-seed/20-commons.mjs), which starts with no reactions. Adds
// one reaction to the demo schema and removes it in the same clip; a re-seed clears any left behind.
const POST = 'Does anybody know a laundromat near the bus station that stays open late? Mine closes at 8.';

function message(page) {
  // The innermost block holding both the post's words and its reaction control is that one message.
  return page
    .locator('div')
    .filter({ has: page.getByText(POST, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Add a reaction', exact: true }) })
    .last();
}

export default {
  slug: 'feed-react-to-a-post',
  title: 'Commons: react to a post',
  steps: [
    {
      say: 'Another member asked a question in the channel. You can answer it, or just let them know you saw it.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/'));
        const post = page.getByText(POST, { exact: true }).first();
        await post.waitFor({ timeout: 20_000 });
        await post.scrollIntoViewIfNeeded();
        await highlight(post);
      },
    },
    {
      say: 'The smiley button under a post opens the reactions.',
      do: async ({ page, highlight }) => highlight(message(page).getByRole('button', { name: 'Add a reaction', exact: true })),
    },
    {
      say: 'There are eight to choose from.',
      do: async ({ page, highlight }) => {
        const row = message(page);
        await row.getByRole('button', { name: 'Add a reaction', exact: true }).click();
        const picker = row.getByRole('menu', { name: 'Pick a reaction' });
        await picker.waitFor({ timeout: 10_000 });
        await highlight(picker);
      },
    },
    {
      say: 'Pick the thumbs-up. It shows under the post with a count, lit up because it is yours.',
      do: async ({ page, highlight }) => {
        const row = message(page);
        await row.getByRole('button', { name: 'React with 👍', exact: true }).click();
        const chip = row.getByRole('button', { name: /^👍 reaction, 1, you reacted$/ });
        await chip.waitFor({ timeout: 20_000 });
        await highlight(chip);
      },
    },
    {
      say: 'Press it again to take your reaction off. You cannot react to your own posts.',
      do: async ({ page }) => {
        const row = message(page);
        await row.getByRole('button', { name: /^👍 reaction, 1, you reacted$/ }).click();
        await row.getByRole('button', { name: /^👍 reaction, 1, you reacted$/ }).waitFor({ state: 'detached', timeout: 20_000 });
      },
    },
  ],
};
