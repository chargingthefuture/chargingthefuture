// SocketRelay's Direct Line: opens the seeded request the demo account is helping with ("Help moving a
// few boxes") and goes back to the list. Nothing is sent and nothing is written.
export default {
  slug: 'socket-relay-direct-line',
  title: 'SocketRelay: the Direct Line',
  steps: [
    {
      say: 'Direct Line holds your private conversations about requests.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/socket-relay'));
        await button('Direct Line').waitFor({ timeout: 20_000 });
        await button('Direct Line').click();
        await page.getByRole('button', { name: /Help moving a few boxes/ }).first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each row names the request and your part in it. Here, you are helping with somebody\'s move.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: /Help moving a few boxes/ }).first()),
    },
    {
      say: 'Open a row to talk it through with the other person. Only the two of you are in it.',
      do: async ({ page }) => {
        await page.getByRole('button', { name: /Help moving a few boxes/ }).first().click();
        await page.getByText(/You offered to help/).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Only the person who posted the request can close it, once the favor is done.',
      do: async ({ page, highlight }) => highlight(page.getByText(/Only the person who posted this request can close it/)),
    },
    {
      say: 'All conversations takes you back to the list.',
      do: async ({ button, highlight }) => {
        await highlight(button('All conversations'));
      },
    },
  ],
};
