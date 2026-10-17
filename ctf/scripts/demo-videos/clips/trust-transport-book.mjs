// TrustTransport's Book tab: filling in a ride request. The Book button is highlighted, never
// pressed, so no request is added to the demo board. No write to the demo data.
export default {
  slug: 'trust-transport-book',
  title: 'TrustTransport: ask for a ride',
  steps: [
    {
      say: 'TrustTransport is where members ask for and offer rides, package drops and food runs. Drivers are fellow members.',
      speak: 'Trust Transport is where members ask for and offer rides, package drops and food runs. Drivers are fellow members.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/trust-transport'));
        await page.getByLabel('Pickup location').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Enter where you are starting and where you are going.',
      do: async ({ page, highlight }) => {
        const from = page.getByLabel('Pickup location');
        await from.click();
        await from.pressSequentially('Oakland', { delay: 40 });
        const to = page.getByLabel('Destination');
        await to.click();
        await to.pressSequentially('San Francisco', { delay: 40 });
        await highlight(to);
      },
    },
    {
      say: 'Pick how you will settle it. Asking for a free ride is okay. You can also offer ServiceCredits, money, crypto, or a barter.',
      speak: 'Pick how you will settle it. Asking for a free ride is okay. You can also offer Service Credits, money, crypto, or a barter.',
      do: async ({ page, highlight }) => highlight(page.getByLabel('How will you settle this ride?')),
    },
    {
      say: 'Press Book. Your request goes up for members who can offer to help.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: /^Book / }).first()),
    },
  ],
};
