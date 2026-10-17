// Commons: writes a post to the shared channel. Adds one post to the demo schema's Commons on every
// run. Points at Delete without pressing it.
const POST = 'Morning, all. I am new here and reading through the apps today.';

export default {
  slug: 'feed-post',
  title: 'Commons: post to the channel',
  steps: [
    {
      say: 'Type in the box at the bottom to post to the channel.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/'));
        const box = page.locator('#chat-input');
        await box.waitFor({ timeout: 20_000 });
        await box.click();
        await box.pressSequentially(POST, { delay: 35 });
        await highlight(box);
      },
    },
    {
      say: 'Press the arrow to send. Enter starts a new line, so you can write in paragraphs.',
      do: async ({ button, highlight }) => highlight(button('Send message')),
    },
    {
      say: 'Your post shows in the channel under your name.',
      do: async ({ page, button }) => {
        await button('Send message').click();
        await page.getByText(POST, { exact: true }).last().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Delete takes down anything you wrote. It asks first, because it cannot be undone.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: 'Delete your post', exact: true }).last()),
    },
  ],
};
