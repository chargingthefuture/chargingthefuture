// SocketRelay's feed: other members' open requests, their handles, tags and how each is settled,
// then a tag chip filtering the list and the All chip clearing it. Uses the open requests from
// demo-seed/42-socket-relay.mjs. Reads only; no write to the demo data.
const CARD = 'Help setting up a new phone';

export default {
  slug: 'socket-relay-browse-the-feed',
  title: 'SocketRelay: browse the feed',
  steps: [
    {
      say: 'The SocketRelay feed lists open requests from other members: small tasks and favors anyone can help with.',
      speak: 'The Socket Relay feed lists open requests from other members: small tasks and favors anyone can help with.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/socket-relay'));
        await page.getByText(CARD, { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each card shows who asked, by handle, with up to three tags and how it is settled. Most are free; this one offers ServiceCredits.',
      speak: 'Each card shows who asked, by handle, with up to three tags and how it is settled. Most are free; this one offers Service Credits.',
      do: async ({ page, highlight }) => {
        const card = page.getByText(CARD, { exact: true }).locator('xpath=../../..');
        await card.scrollIntoViewIfNeeded();
        await highlight(card);
      },
    },
    {
      say: 'I can help offers your time. A private Direct Line then opens between the two of you.',
      do: async ({ page, highlight }) => {
        const card = page.getByText(CARD, { exact: true }).locator('xpath=../../..');
        await highlight(card.getByRole('button', { name: 'I can help', exact: true }));
      },
    },
    {
      say: 'The chips at the top come from the tags on the board, most used first. Tap one to see only those requests.',
      do: async ({ page, highlight }) => {
        await page.evaluate(() => window.scrollTo({ top: 0 }));
        const chip = page.getByRole('button', { name: 'jobs', exact: true }).first();
        await chip.click();
        await page.getByText('Ride to a job interview on Tuesday', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(chip);
      },
    },
    {
      say: 'All shows every open request again.',
      do: async ({ page, highlight }) => {
        const all = page.getByRole('button', { name: 'All', exact: true }).first();
        await all.click();
        await page.getByText(CARD, { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(all);
      },
    },
  ],
};
