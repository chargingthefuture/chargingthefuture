// Fireside: opens the conversation under the blog's Dictionary post, the way the button under a post
// does, and leaves a comment. Writes one top-level comment into the demo schema's thread for that
// post on every run. Never touches the request to have a comment published on the blog.
const THREAD = '/apps/fireside?repo=chargingthefuture%2Fchargingthefuture&slug=Dictionary&title=Dictionary%3A%20Skills%20Economy%20Terms';
const COMMENT = 'This is the page I send to somebody new.';

export default {
  slug: 'fireside-leave-a-comment',
  title: 'Fireside: leave a comment',
  steps: [
    {
      say: 'Every post on the blog has a conversation under it. The button under a post opens that same conversation here, in Fireside.',
      do: async ({ page, app }) => {
        await page.goto(app(THREAD));
        // The thread has loaded once either its empty line or a comment's Reply control is there.
        await page
          .getByText('Nothing here yet. Say the first thing.')
          .or(page.getByRole('button', { name: 'Reply', exact: true }))
          .first()
          .waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Back to the post returns you to the post you were reading.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: /Back to the post/ }).first()),
    },
    {
      say: 'Write in the box under the conversation.',
      do: async ({ page, highlight }) => {
        const box = page.getByPlaceholder('Say something about this post');
        await box.click();
        await box.pressSequentially(COMMENT, { delay: 35 });
        await highlight(box);
      },
    },
    {
      say: 'Press Post. Until your account is approved through Unlock, what you write is held, and the screen says so when you post.',
      do: async ({ button, highlight }) => highlight(button('Post')),
    },
    {
      say: 'Comments run oldest first, so yours goes at the end. Agreeing with a comment never moves it.',
      do: async ({ page, button }) => {
        await button('Post').click();
        await page.getByText(COMMENT, { exact: true }).last().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each comment has three reactions: I recognize this, This helped, and Same here.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: /^I recognize this/ }).last()),
    },
  ],
};
