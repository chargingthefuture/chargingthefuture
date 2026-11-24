// 3.1 Activity: answers and news about your own posts. Opens it, which marks nothing read.
import { openTab, tabButton } from '../lib/se-31.mjs';

export default {
  slug: 'v31-activity',
  title: 'Activity',
  steps: [
    {
      say: 'Activity is what happened around you: answers to your posts, and people who need you.',
      do: async ({ page, app, highlight }) => {
        await openTab(page, app, 'activity');
        await highlight(tabButton(page, 'Activity'));
      },
    },
    {
      say: 'Today comes first, then earlier. Tap a line to open what it is about.',
      do: async ({ page, highlight }) => {
        // With no activity yet the screen shows one line instead of day groups.
        const groups = page.getByRole('heading', { level: 2 });
        const empty = page.locator('main p').first();
        await groups.first().or(empty).waitFor();
        await highlight((await groups.count()) > 0 ? groups.first() : empty);
      },
    },
  ],
};
