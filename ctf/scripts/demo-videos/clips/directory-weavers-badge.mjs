// Directory: the Weavers of the Commons badge on a claimed profile, its dialog, and a profile without
// it. Uses Maya Thompson from demo-seed/12-directory.mjs. Reads only. No write to the demo data.
const MAYA = '/apps/directory/profile/ddd00000-0000-4000-8120-000000000001';
const JORDAN = '/apps/directory/profile/ddd00000-0000-4000-8000-000000000020';

export default {
  slug: 'directory-weavers-badge',
  title: 'Directory: the Weavers of the Commons badge',
  steps: [
    {
      say: 'Some profiles carry a small braid badge next to the name.',
      do: async ({ page, app, button, highlight }) => {
        await page.goto(app(MAYA));
        await page.getByText('Maya Thompson', { exact: true }).first().waitFor({ timeout: 20_000 });
        await highlight(button('Weavers of the Commons'));
      },
    },
    {
      say: 'It means this member is a consistent, broad contributor to the community. Anyone can earn it.',
      do: async ({ page, button, highlight }) => {
        await button('Weavers of the Commons').click();
        await highlight(page.getByRole('dialog', { name: 'Weavers of the Commons' }));
      },
    },
    {
      say: 'How it\'s earned explains the badge in plain words. There is no score and no ranking.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: 'How it’s earned' })),
    },
    {
      say: 'A profile without the badge shows nothing in its place. No empty slot, and no "not yet" label.',
      do: async ({ page, app, highlight }) => {
        await page.keyboard.press('Escape');
        await page.goto(app(JORDAN));
        await page.getByText('Jordan Kim', { exact: true }).first().waitFor({ timeout: 20_000 });
        await highlight(page.getByText('Jordan Kim', { exact: true }).first());
      },
    },
  ],
};
