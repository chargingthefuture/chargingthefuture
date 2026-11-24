// 3.1 Me: your own page, your ServiceCredits and your tools. Writes nothing.
import { openTab } from '../lib/se-31.mjs';

export default {
  slug: 'v31-me',
  title: 'Me',
  steps: [
    {
      say: 'Me is your own page: your name, what you have posted, and your tools.',
      do: async ({ page, app }) => {
        await openTab(page, app, 'me');
        await page.getByRole('button', { name: 'Settings', exact: true }).waitFor({ timeout: 30_000 });
      },
    },
    {
      say: 'Your ServiceCredits are here. They are credits, not money.',
      do: async ({ page, highlight }) => highlight(page.getByRole('region', { name: 'ServiceCredits' })),
    },
    {
      say: 'Tools holds the rest of what the app can do for you.',
      do: async ({ page, highlight }) => highlight(page.getByRole('heading', { name: 'Tools' })),
    },
    {
      say: 'The gear opens Settings, where you choose your colors, text size and notifications.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: 'Settings', exact: true })),
    },
  ],
};
