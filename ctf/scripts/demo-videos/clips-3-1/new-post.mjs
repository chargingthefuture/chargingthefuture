// 3.1 New: the sheet for posting an ask, an offer, a story or a talk. Opens it and posts nothing.
import { openTab, tabButton } from '../lib/se-31.mjs';

export default {
  slug: 'v31-new',
  title: 'New',
  steps: [
    {
      say: 'The plus button in the middle of the bar is where you post something.',
      do: async ({ page, app, highlight }) => {
        await openTab(page, app, 'today');
        await highlight(tabButton(page, 'New'));
      },
    },
    {
      say: 'It opens one sheet for every kind of post.',
      do: async ({ page }) => {
        await tabButton(page, 'New').click();
        await page.getByRole('heading', { name: 'Post something' }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Pick what it is: an ask, an offer, a story, or a talk you want to give.',
      do: async ({ page, highlight }) => highlight(page.getByRole('group', { name: 'Kind of post' })),
    },
    {
      say: 'Write it in your own words and post it. It shows on Today for others to answer.',
      do: async ({ page, highlight }) => highlight(page.getByRole('heading', { name: 'Post something' })),
    },
  ],
};
