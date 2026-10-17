// Foundation's Quotes tab: the member's quote requests, then reopens the Direct Line on one. Seed
// Demo creates the pending quote this clip opens. Reads only; the chat runs on the staging Stream app.
export default {
  slug: 'foundation-quotes',
  title: 'Foundation: your quote requests',
  steps: [
    {
      say: 'The Quotes tab keeps track of every request you have made.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/foundation'));
        await button('Quotes').click();
        await page.getByText('My Quote Requests', { exact: true }).waitFor({ timeout: 20_000 });
        await button('Direct Line').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each request shows its status. Pending means the provider has not answered yet.',
      do: async ({ page, highlight }) => highlight(page.getByText('Pending', { exact: true }).first()),
    },
    {
      say: 'Direct Line opens your private chat with that provider again.',
      do: async ({ button, highlight }) => highlight(button('Direct Line')),
    },
    {
      say: 'The conversation picks up where you left it.',
      do: async ({ page, button }) => {
        await button('Direct Line').click();
        await button('Back').waitFor({ timeout: 20_000 });
        await page.getByText('Opening Direct Line…').waitFor({ state: 'hidden', timeout: 30_000 });
        if (await page.getByText('Could not open this Direct Line.').count()) {
          throw new Error('the Direct Line said it could not open');
        }
      },
    },
    {
      say: 'Back returns you to your requests.',
      do: async ({ page, button }) => {
        await button('Back').click();
        await page.getByText('My Quote Requests', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
  ],
};
