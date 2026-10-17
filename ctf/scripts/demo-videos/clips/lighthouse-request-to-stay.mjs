// LightHouse: the Request to stay form on a listing. Types a message but does not send it, so it
// makes no writes.
export default {
  slug: 'lighthouse-request-to-stay',
  title: 'LightHouse: request to stay',
  steps: [
    {
      say: 'Found a place that fits? Open the listing.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/lighthouse'));
        const card = page.getByRole('button', { name: /^View .*Studio near Transit Hub$/ }).first();
        await card.waitFor({ timeout: 20_000 });
        await card.click();
        await page.getByText('Listing Detail').first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Press Request to stay.',
      do: async ({ button, highlight }) => highlight(button('Request to stay')),
    },
    {
      say: 'Add a short message to the host, and the date you would like to move in. Both are optional.',
      do: async ({ page, button, highlight }) => {
        await button('Request to stay').click();
        const box = page.getByLabel('Message to the host (optional)');
        await box.waitFor({ timeout: 20_000 });
        await box.click();
        await box.pressSequentially('Hi, I am looking for a quiet place from next month.', { delay: 35 });
        await highlight(box);
      },
    },
    {
      say: 'Send request passes it to the host. You can follow it in the Matches tab.',
      do: async ({ button, highlight }) => highlight(button('Send request')),
    },
  ],
};
