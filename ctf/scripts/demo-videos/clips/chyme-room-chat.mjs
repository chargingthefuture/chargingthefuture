// Chyme's Room Chat: opens it and sends one message. Writes one chat message to the demo room on
// every run.
const MESSAGE = 'Listening in from the night shift tonight.';

export default {
  slug: 'chyme-room-chat',
  title: 'Chyme: the room chat',
  steps: [
    {
      say: 'Chat opens the room\'s text chat. It starts closed.',
      do: async ({ page, app, button, highlight }) => {
        await page.goto(app('/apps/chyme'));
        await button('Chat').waitFor({ timeout: 20_000 });
        await highlight(button('Chat'));
      },
    },
    {
      say: 'Room Chat holds the messages. They are still there when you come back.',
      do: async ({ page, button }) => {
        await button('Chat').click();
        await page.getByText('Room Chat', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Write your message in the box.',
      do: async ({ page, highlight }) => {
        const box = page.getByPlaceholder('Send a message…');
        await box.click();
        await box.pressSequentially(MESSAGE, { delay: 35 });
        await highlight(box);
      },
    },
    {
      say: 'Press Send. It shows in the list right away.',
      do: async ({ page, button }) => {
        await button('Send').click();
        await page.getByText(MESSAGE, { exact: true }).last().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Under your own messages, Edit puts the text back in the box to send again, and Delete removes it.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: 'Delete your message', exact: true }).last().locator('..')),
    },
  ],
};
