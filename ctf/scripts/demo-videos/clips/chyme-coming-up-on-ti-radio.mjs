// Chyme's "Coming up on TI Radio" rail: the next booked TI Radio discussions, soonest first, with
// a link to the full guide. Uses the booked slots from demo-seed/44-ti-radio.mjs. Reads only; no
// write to the demo data.
const FIRST = 'Finding work with flexible hours';

export default {
  slug: 'chyme-coming-up-on-ti-radio',
  title: 'Chyme: coming up on TI Radio',
  steps: [
    {
      say: 'Under the rooms, Chyme lists what is coming up on TI Radio: discussions members have booked for this week.',
      speak: 'Under the rooms, Chyme lists what is coming up on T I Radio: discussions members have booked for this week.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/apps/chyme'));
        const rail = page.getByRole('region', { name: 'Coming up on TI Radio' }).first();
        await rail.getByText(FIRST, { exact: true }).waitFor({ timeout: 20_000 });
        await rail.scrollIntoViewIfNeeded();
        await highlight(rail);
      },
    },
    {
      say: 'Each card gives the day and time in your own timezone, the subject, and who is hosting.',
      do: async ({ page, highlight }) => {
        const rail = page.getByRole('region', { name: 'Coming up on TI Radio' }).first();
        await highlight(rail.getByRole('listitem').filter({ hasText: FIRST }));
      },
    },
    {
      say: 'The soonest is first. Drag the row sideways to see the rest.',
      do: async ({ page }) => {
        const list = page.getByRole('region', { name: 'Coming up on TI Radio' }).first().getByRole('list');
        await list.evaluate((el) => el.scrollBy({ left: 360, behavior: 'smooth' }));
        await page.waitForTimeout(1200);
        await list.evaluate((el) => el.scrollTo({ left: 0, behavior: 'smooth' }));
      },
    },
    {
      say: 'At the time on the card, come back to Chyme. That is where the discussion happens.',
      do: async ({ page, highlight }) => highlight(page.getByRole('region', { name: 'Coming up on TI Radio' }).first().getByText('Hosted by @alex_rivera', { exact: true })),
    },
    {
      say: 'Full guide opens the TI Radio schedule, where any approved member can book an open slot.',
      speak: 'Full guide opens the T I Radio schedule, where any approved member can book an open slot.',
      do: async ({ page, highlight }) => {
        const link = page.getByRole('link', { name: 'Full guide →' }).first();
        await highlight(link);
        await page.waitForTimeout(1200);
        await link.click();
        await page.waitForURL(/\/ti-radio/, { timeout: 20_000 });
      },
    },
  ],
};
