// Fireside: a comment of the member's own, with another member's reply and a reaction on it, rewritten
// in place. Uses the seeded comments under the blog's Dictionary post (demo-seed/21-fireside.mjs).
// Changes the words of that seeded comment in the demo schema; a re-seed puts them back.
const THREAD = '/apps/fireside?repo=chargingthefuture%2Fchargingthefuture&slug=Dictionary&title=Dictionary%3A%20Skills%20Economy%20Terms';
const MINE = 'I keep this page open when I write to somebody new. The plain definitions save a lot of back and forth.';
const REPLY = 'Same here. I sent the Directory entry to my sister last week and she understood it on the first read.';
const FIXED = 'I keep this page open when I write to somebody new. The plain definitions save a lot of explaining.';

function mineCard(page, text) {
  // The innermost block holding both the words and an Edit button is the comment itself.
  return page
    .locator('div')
    .filter({ has: page.getByText(text, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Edit', exact: true }) })
    .last();
}

export default {
  slug: 'fireside-fix-your-comment',
  title: 'Fireside: fix your own comment',
  steps: [
    {
      say: 'This is a comment you wrote under a post. Somebody marked it I recognize this.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app(THREAD));
        const mine = page.getByText(MINE, { exact: true });
        await mine.waitFor({ timeout: 20_000 });
        await highlight(mineCard(page, MINE).getByRole('button', { name: /^I recognize this/ }));
      },
    },
    {
      say: 'Another member replied, and the reply sits under your comment.',
      do: async ({ page, highlight }) => {
        const reply = page.getByText(REPLY, { exact: true });
        await reply.scrollIntoViewIfNeeded();
        await highlight(reply);
      },
    },
    {
      say: 'Edit lets you fix your own words in place. You can only edit what you wrote.',
      do: async ({ page, highlight }) => highlight(mineCard(page, MINE).getByRole('button', { name: 'Edit', exact: true })),
    },
    {
      say: 'Change the words. Saving marks the comment as edited, and the reply and reactions stay where they are.',
      do: async ({ page, highlight }) => {
        await mineCard(page, MINE).getByRole('button', { name: 'Edit', exact: true }).click();
        const box = page.getByLabel('Rewrite your comment');
        await box.waitFor({ timeout: 10_000 });
        await box.fill('');
        await box.pressSequentially(FIXED, { delay: 30 });
        await highlight(box);
      },
    },
    {
      say: 'Press Save. The new words show with an Edited mark, so nobody reads them as the originals.',
      do: async ({ page, button, highlight }) => {
        await button('Save').click();
        await page.getByText(FIXED, { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(mineCard(page, FIXED).getByText('Edited', { exact: true }));
      },
    },
  ],
};
