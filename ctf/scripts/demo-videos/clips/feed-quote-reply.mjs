// Commons: replies to another member's post so the reply carries a quote of it. Reads the seeded
// quoted reply by @june_park (demo-seed/20-commons.mjs), then writes one reply post into the demo
// schema's Commons on every run.
const QUOTED = 'The one on Fifth Street is open until 11. The card reader there was broken last week, so bring quarters.';
const REPLY = 'Good to know. I will go Thursday.';

export default {
  slug: 'feed-quote-reply',
  title: 'Commons: reply to a post',
  steps: [
    {
      say: 'A reply in the channel carries a short quote of the post it answers, so you can see what it is about.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/'));
        await page.getByText(QUOTED, { exact: true }).first().waitFor({ timeout: 20_000 });
        const quote = page.getByRole('button', { name: 'Go to the message from @dan_whitaker that this replies to' }).first();
        await quote.scrollIntoViewIfNeeded();
        await highlight(quote);
      },
    },
    {
      say: 'Press the quote to jump to the original post.',
      do: async ({ page }) => {
        await page.getByRole('button', { name: 'Go to the message from @dan_whitaker that this replies to' }).first().click();
        await page.waitForTimeout(800);
      },
    },
    {
      say: 'To reply yourself, press Reply under the post.',
      do: async ({ page, highlight }) => {
        const reply = page.getByRole('button', { name: 'Reply to @june_park', exact: true }).first();
        await reply.scrollIntoViewIfNeeded();
        await highlight(reply);
      },
    },
    {
      say: 'The box at the bottom shows who you are replying to. Write your answer there.',
      do: async ({ page, highlight }) => {
        await page.getByRole('button', { name: 'Reply to @june_park', exact: true }).first().click();
        await page.getByText('Replying to @june_park').waitFor({ timeout: 10_000 });
        const box = page.locator('#chat-input');
        await box.click();
        await box.pressSequentially(REPLY, { delay: 35 });
        await highlight(page.getByText('Replying to @june_park'));
      },
    },
    {
      say: 'Send it. Your reply goes in the channel with the quote above it, and the member you answered is told.',
      do: async ({ page, button }) => {
        await button('Send message').click();
        await page.getByText(REPLY, { exact: true }).last().waitFor({ timeout: 20_000 });
        await page.getByRole('button', { name: 'Go to the message from @june_park that this replies to' }).last().waitFor({ timeout: 20_000 });
      },
    },
  ],
};
