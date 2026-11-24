// 3.1 Today for a visitor who is not signed in. Uses no account and writes nothing.
export default {
  slug: 'v31-signed-out-today',
  title: 'Today, before you sign in',
  signIn: false,
  steps: [
    {
      say: 'Anybody can see Today before signing in. The cards show what is happening, without names.',
      do: async ({ page, app }) => {
        await page.goto(app('/today'));
        await page.getByRole('navigation', { name: 'Main' }).waitFor({ timeout: 30_000 });
      },
    },
    {
      say: 'Sign in at the top if you have an account.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: 'Sign in' }).first()),
    },
    {
      say: 'Sign up at the bottom to make one. It is free, and everyone is let in one at a time after a check.',
      do: async ({ page, highlight }) => highlight(page.getByRole('navigation', { name: 'Main' })),
    },
  ],
};
