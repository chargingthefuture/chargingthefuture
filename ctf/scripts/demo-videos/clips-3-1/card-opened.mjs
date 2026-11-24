// 3.1 Today: one card opened in place, then closed. Writes nothing.
import { openTab } from '../lib/se-31.mjs';

export default {
  slug: 'v31-card-opened',
  title: 'A card opened',
  steps: [
    {
      say: 'Each card on Today opens in place.',
      do: async ({ page, app }) => {
        await openTab(page, app, 'today');
        await page.getByRole('heading', { name: "Today's cards" }).waitFor({ timeout: 30_000 });
      },
    },
    {
      say: 'Tap the text of a card to open it.',
      do: async ({ page, highlight }) => {
        const card = page.locator('button[aria-haspopup="dialog"]').filter({ hasText: /\S/ }).first();
        await highlight(card);
        await card.click();
      },
    },
    {
      say: 'The card shows all of what was written, and the conversation under it. Answer here when you can help.',
      do: async ({ page, highlight }) => {
        const sheet = page.getByRole('dialog').first();
        await sheet.waitFor({ timeout: 20_000 });
        await highlight(sheet.getByRole('heading').first());
      },
    },
    {
      say: 'Close it to go back to the list.',
      do: async ({ page }) => page.keyboard.press('Escape'),
    },
  ],
};
