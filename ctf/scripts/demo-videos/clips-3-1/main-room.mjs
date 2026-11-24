// 3.1 Main Room: the room card on Today, then listening in. Listening says nothing in the room.
import { openTab } from '../lib/se-31.mjs';

const PRIMARY = /^(Listen in|Play readings)$/;

export default {
  slug: 'v31-main-room',
  title: 'The Main Room',
  steps: [
    {
      say: 'The Main Room is the live audio room everybody shares. Its card sits on Today.',
      do: async ({ page, app, highlight }) => {
        await openTab(page, app, 'today');
        const button = page.getByRole('button', { name: PRIMARY }).first();
        await button.waitFor({ timeout: 30_000 });
        await highlight(button);
      },
    },
    {
      say: 'When somebody is talking, listen in. When the room is quiet, it plays recorded readings of the blog.',
      do: async ({ page }) => {
        await page.getByRole('button', { name: PRIMARY }).first().click();
        await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 30_000 });
      },
    },
    {
      say: 'The room stays open in a bar above the tabs while you look at the rest of the app.',
      do: async ({ pause }) => pause(1),
    },
  ],
};
