// SocketRelay's Direct Line: opens the seeded request the demo account is helping with ("Help moving a
// few boxes", demo-seed/42-socket-relay.mjs ties it to the account) and goes back to the list. The
// row is found by "You're helping", which every row the account helps on carries, so a request title
// that did not load does not stop the clip. Nothing is sent and nothing is written.
const helping = (page) => page.getByRole('button', { name: /You're helping/ }).first();

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
        await helping(page).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each row names the request and your part in it. Here, you are helping somebody with theirs.',
      do: async ({ page, highlight }) => highlight(helping(page)),
    },
    {
      say: 'Open a row to talk it through with the other person. Only the two of you are in it.',
      do: async ({ page }) => {
        await helping(page).click();
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
