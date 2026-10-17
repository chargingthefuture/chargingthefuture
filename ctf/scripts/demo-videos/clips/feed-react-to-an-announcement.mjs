// Commons: an official announcement card and its reactions. Uses the seeded announcement "Small
// tasks on the goal board" (demo-seed/20-commons.mjs). Adds one reaction to the demo schema and takes
// it off again in the same clip; a re-seed clears any left behind.
const TITLE = 'Small tasks on the goal board';

function card(page) {
  return page.getByRole('article', { name: 'Official announcement' }).filter({ hasText: TITLE }).first();
}

export default {
  slug: 'feed-react-to-an-announcement',
  title: 'Commons: react to an announcement',
  steps: [
    {
      say: 'Official notes show as their own card, with a shield badge and the name of the person who wrote them.',
      do: async ({ page, app, button, highlight }) => {
        await page.goto(app('/'));
        await page.locator('#chat-input').waitFor({ timeout: 20_000 });
        await button('Show only announcements').click();
        await card(page).waitFor({ timeout: 20_000 });
        await card(page).scrollIntoViewIfNeeded();
        await highlight(card(page));
      },
    },
    {
      say: 'Under it you see the reactions other members left.',
      do: async ({ page, highlight }) => highlight(card(page).getByRole('button', { name: /^👍 reaction, 1/ })),
    },
    {
      say: 'Add your own from the smiley button. Here, the folded hands.',
      do: async ({ page, highlight }) => {
        const c = card(page);
        await c.getByRole('button', { name: 'Add a reaction', exact: true }).click();
        await c.getByRole('button', { name: 'React with 🙏', exact: true }).click();
        const chip = c.getByRole('button', { name: /^🙏 reaction, 1, you reacted$/ });
        await chip.waitFor({ timeout: 20_000 });
        await highlight(chip);
      },
    },
    {
      say: 'Press it again to take it off. Reply opens a thread under the card, for questions about the note.',
      do: async ({ page, highlight }) => {
        const c = card(page);
        await c.getByRole('button', { name: /^🙏 reaction, 1, you reacted$/ }).click();
        await c.getByRole('button', { name: /^🙏 reaction, 1, you reacted$/ }).waitFor({ state: 'detached', timeout: 20_000 });
        await highlight(c.getByRole('button', { name: /^Show replies/ }));
      },
    },
  ],
};
