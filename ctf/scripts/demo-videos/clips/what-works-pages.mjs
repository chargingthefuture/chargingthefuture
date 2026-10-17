// WhatWorks paging: five problems a page with Previous and Next, and a problem with more than two
// tools folded behind "Show N more tools". Uses the extra problems from demo-seed/41-what-works.mjs.
// Reads only; no write to the demo data.
export default {
  slug: 'what-works-pages',
  title: 'WhatWorks: moving through the list',
  steps: [
    {
      say: 'The WhatWorks list shows five problems at a time. It ends at the bottom instead of loading more as you scroll.',
      speak: 'The What Works list shows five problems at a time. It ends at the bottom instead of loading more as you scroll.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/apps/what-works'));
        await page.getByRole('heading', { name: 'Noise & Verbal Harassment' }).waitFor({ timeout: 20_000 });
        const pageLabel = page.getByText(/^Page 1 of \d+$/);
        await pageLabel.scrollIntoViewIfNeeded();
        await highlight(pageLabel.locator('xpath=../..'));
      },
    },
    {
      say: 'Next moves to the next five and takes you back to the top.',
      do: async ({ page, button }) => {
        await button('Next').click();
        await page.getByRole('heading', { name: 'Charging Away From Home' }).waitFor({ timeout: 20_000 });
        await page.waitForTimeout(800);
      },
    },
    {
      say: 'A problem shows its first two tools. This button says how many more there are.',
      do: async ({ page, highlight }) => {
        const more = page.getByRole('button', { name: 'Show 2 more tools', exact: true });
        await more.scrollIntoViewIfNeeded();
        await highlight(more);
      },
    },
    {
      say: 'Tap it to see them all, and Show fewer to fold them away again.',
      do: async ({ page, highlight }) => {
        await page.getByRole('button', { name: 'Show 2 more tools', exact: true }).click();
        const fewer = page.getByRole('button', { name: 'Show fewer', exact: true });
        await fewer.waitFor({ timeout: 20_000 });
        await highlight(fewer);
      },
    },
    {
      say: 'Previous goes back a page. It is grayed out on the first page.',
      do: async ({ page, button, highlight }) => {
        const previous = button('Previous');
        await previous.scrollIntoViewIfNeeded();
        await previous.click();
        await page.getByRole('heading', { name: 'Noise & Verbal Harassment' }).waitFor({ timeout: 20_000 });
        const again = button('Previous');
        await again.scrollIntoViewIfNeeded();
        await highlight(again);
      },
    },
  ],
};
