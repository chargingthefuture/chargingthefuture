// 3.1 People: who is in the community and what they can do. Writes nothing.
import { openTab } from '../lib/se-31.mjs';

export default {
  slug: 'v31-people',
  title: 'People',
  steps: [
    {
      say: 'People is where you find somebody with the skill you need.',
      do: async ({ page, app }) => {
        await openTab(page, app, 'people');
        await page.getByRole('heading', { name: 'People', exact: true }).waitFor({ timeout: 30_000 });
      },
    },
    {
      say: 'The buttons at the top narrow the list.',
      do: async ({ page, highlight }) => highlight(page.getByRole('radiogroup', { name: 'Show' })),
    },
    {
      say: 'Each person shows their skills. Open one to see more, or to ask them for help.',
      do: async ({ scroll }) => scroll(300),
    },
  ],
};
