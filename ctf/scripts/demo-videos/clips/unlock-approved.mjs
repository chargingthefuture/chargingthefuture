// Unlock's status screen for an approved member, and the "What gets an account banned" row opened
// and closed. Reads only.
export default {
  slug: 'unlock-approved',
  title: 'Unlock: what approval opens, and what gets an account banned',
  steps: [
    {
      say: 'Unlock is how a new account gets approved. You send the address of your Quora profile, and a person reads it.',
      do: async ({ page, app }) => {
        await page.goto(app('/plugin/unlock'));
        await page.getByText('Welcome to Skills Economy (SE)', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Once you are approved, everything in the app opens, and a one-time thank-you of 100 ServiceCredits is sent to you.',
      speak: 'Once you are approved, everything in the app opens, and a one-time thank-you of 100 Service Credits is sent to you.',
      do: async ({ page, highlight }) => highlight(page.getByText('Welcome to Skills Economy (SE)', { exact: true })),
    },
    {
      say: 'Continue to the Commons takes you to the group chat.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: 'Continue to the Commons' })),
    },
    {
      say: 'Further down, this row says what gets an account banned. Tap it to read.',
      do: async ({ page, highlight }) => {
        const row = page.getByRole('button', { name: /What gets an account banned/ });
        await highlight(row);
      },
    },
    {
      say: 'Harassing people here, or running a second account, gets an account banned. Not finishing this step never does.',
      do: async ({ page, highlight }) => {
        await page.getByRole('button', { name: /What gets an account banned/ }).click();
        const line = page.getByText('Not finishing this step is not one of them.', { exact: false });
        await line.waitFor({ timeout: 20_000 });
        await highlight(line);
      },
    },
  ],
};
