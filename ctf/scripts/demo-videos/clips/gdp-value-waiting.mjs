// GDP's "Value waiting to happen" panel: what open posts would add, kept apart from the Community
// Value Index. Shows the open SocketRelay requests from demo-seed/42-socket-relay.mjs. Reads only;
// no write to the demo data.
export default {
  slug: 'gdp-value-waiting',
  title: 'GDP: value waiting to happen',
  steps: [
    {
      say: 'Below the Community Value Index, GDP shows a second figure: Value waiting to happen.',
      speak: 'Below the Community Value Index, G D P shows a second figure: Value waiting to happen.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/apps/gdp'));
        const label = page.getByText('Value waiting to happen', { exact: true });
        await label.waitFor({ timeout: 20_000 });
        await label.scrollIntoViewIfNeeded();
        await highlight(label.locator('xpath=../..'));
      },
    },
    {
      say: 'It is what the posts already on the board would add if every one of them closed, and how many open posts that is.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^across \d[\d,]* open posts?$/)),
    },
    {
      say: 'Most posts never close, so it is interest, not achievement. It is not part of the index, and it is not money.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^This is what the posts already on the board would add/)),
    },
    {
      say: 'Each row names where the open posts are, like SocketRelay requests nobody has done yet.',
      speak: 'Each row names where the open posts are, like Socket Relay requests nobody has done yet.',
      do: async ({ page, highlight }) => {
        const row = page.getByText('SocketRelay requests waiting to be done', { exact: true });
        await row.scrollIntoViewIfNeeded();
        await highlight(row.locator('xpath=../..'));
      },
    },
  ],
};
