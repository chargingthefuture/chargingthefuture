// WhatWorks: marking a tool helpful and taking the mark back. Presses the first tool's toggle twice,
// so the demo account's endorsement ends where it started.
const toggle = (page) => page.getByRole('button', { name: /^(Helpful|Helped me)$/ }).first();

export default {
  slug: 'what-works-helpful',
  title: 'WhatWorks: mark a tool helpful',
  steps: [
    {
      say: 'If a tool on the list worked for you, you can mark it helpful.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/apps/what-works'));
        await page.getByText(/survivors verified$/).first().waitFor({ timeout: 20_000 });
        await highlight(page.getByText(/survivors verified$/).first());
      },
    },
    {
      say: 'Your mark adds to the count other survivors see.',
      do: async ({ page, highlight }) => highlight(toggle(page)),
    },
    {
      say: 'Tap it, and the count changes by one.',
      do: async ({ page, pause, highlight }) => {
        await toggle(page).click();
        await pause(1.5);
        await highlight(toggle(page));
      },
    },
    {
      say: 'Tap it again to change your mind. You only ever count once.',
      do: async ({ page, pause, highlight }) => {
        await toggle(page).click();
        await pause(1.5);
        await highlight(toggle(page));
      },
    },
  ],
};
