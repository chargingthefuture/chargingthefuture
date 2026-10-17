// ServiceCredits' Send tab: the form for sending credits to another member. The Send Credits button
// is highlighted, never pressed, because a completed send pushes a notification to the recipient.
// No write to the demo data.
export default {
  slug: 'service-credits-send',
  title: 'ServiceCredits: send credits',
  steps: [
    {
      say: 'Sending credits has a tab of its own. Open Send.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/service-credits'));
        await page.getByText('Your Balance', { exact: true }).waitFor({ timeout: 20_000 });
        await button('Send').click();
        await page.getByLabel('Recipient username or ID').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Type the username of the member you are sending to.',
      do: async ({ page, highlight }) => highlight(page.getByLabel('Recipient username or ID')),
    },
    {
      say: 'Send with picks how the credits go out: from your balance, or on community credit if you have a line.',
      do: async ({ page, highlight }) => highlight(page.getByLabel('Send method')),
    },
    {
      say: 'Enter how many credits to send.',
      do: async ({ page, highlight }) => {
        const amount = page.getByLabel('Amount in credits');
        await amount.click();
        await amount.pressSequentially('5', { delay: 60 });
        await highlight(amount);
      },
    },
    {
      say: 'Send Credits sends them. The credits land at once, and both balances change straight away.',
      do: async ({ button, highlight }) => highlight(button('Send Credits')),
    },
  ],
};
