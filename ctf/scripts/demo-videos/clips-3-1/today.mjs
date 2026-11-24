// 3.1 Today: the day's cards, the Main Room card at the top, and the tab bar. Writes nothing.
import { openTab, tabButton } from '../lib/se-31.mjs';

export default {
  slug: 'v31-today',
  title: 'Today',
  steps: [
    {
      say: 'This is Today, the first screen. It shows what is happening in the community today, one card at a time.',
      do: async ({ page, app }) => openTab(page, app, 'today'),
    },
    {
      say: "Today's cards are asks, offers, stories and talks from other members, newest first.",
      do: async ({ page, highlight }) => highlight(page.getByRole('heading', { name: "Today's cards" })),
    },
    {
      say: 'The bar along the bottom moves between Today, People, New, Activity and Me.',
      do: async ({ page, highlight }) => highlight(tabButton(page, 'Today')),
    },
  ],
};
