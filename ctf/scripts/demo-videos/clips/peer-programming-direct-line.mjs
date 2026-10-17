// PeerProgramming's Direct Line, signed in as the demo account. It sends one real message into the
// demo schema's cohort chat on every run.
export default {
  slug: 'peer-programming-direct-line',
  title: 'PeerProgramming: the Direct Line',
  steps: [
    {
      say: 'Direct Line is your cohort\'s text chat. It carries on between calls, for whoever could not make it.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/peer-programming'));
        await button('Direct Line').click();
        await page.getByLabel('Message your cohort').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Write your message in the box at the bottom.',
      do: async ({ page, highlight }) => {
        const box = page.getByLabel('Message your cohort');
        await box.click();
        await box.pressSequentially('I can take a card on the groceries goal tonight.', { delay: 35 });
        await highlight(box);
      },
    },
    {
      say: 'Press Send.',
      do: async ({ button, highlight }) => highlight(button('Send')),
    },
    {
      say: 'Everyone in your cohort can read it, whether or not they were on the call.',
      do: async ({ page, button }) => {
        await button('Send').click();
        await page.getByText('I can take a card on the groceries goal tonight.').last().waitFor({ timeout: 20_000 });
      },
    },
  ],
};
