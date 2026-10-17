// Commons, the home page: the shared channel and its filter buttons. Writes nothing.
export default {
  slug: 'feed-tour',
  title: 'Commons: the shared channel',
  steps: [
    {
      say: 'This is Commons, the home page. It is one shared channel: official notes, answers from the assistant, and posts from other members.',
      do: async ({ page, app }) => {
        await page.goto(app('/'));
        await page.locator('#chat-input').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'The megaphone button shows only the official notes.',
      do: async ({ button, highlight }) => highlight(button('Show only announcements')),
    },
    {
      say: 'Official notes carry a shield badge and the name of the person who wrote them.',
      do: async ({ page, button, highlight }) => {
        await button('Show only announcements').click();
        const card = page.getByRole('article', { name: 'Official announcement' }).first();
        await card.waitFor({ timeout: 20_000 });
        await highlight(card);
      },
    },
    {
      say: 'Press it again to see everything. The at sign button shows only the messages that mention you.',
      do: async ({ button, highlight }) => {
        await button('Show all messages').click();
        await highlight(button('Show only messages that mention you'));
      },
    },
    {
      say: 'To ask the assistant a question, type at comic in your message.',
      do: async ({ page, highlight }) => highlight(page.getByText('AI Assistant (human-in-the-loop)', { exact: false }).first()),
    },
  ],
};
