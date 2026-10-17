// Directory: a profile showing a skill that is not in the official list yet, as a "pending review"
// chip beside its listed skills. Uses Maya Thompson from demo-seed/12-directory.mjs. Reads only.
const MAYA = '/apps/directory/profile/ddd00000-0000-4000-8120-000000000001';

export default {
  slug: 'directory-pending-skill',
  title: 'Directory: skills waiting to be added to the list',
  steps: [
    {
      say: 'Specializations lists the skills a person holds.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app(MAYA));
        await page.getByText('Specializations', { exact: true }).first().waitFor({ timeout: 20_000 });
        await highlight(page.getByText('Specializations', { exact: true }).first());
      },
    },
    {
      say: 'Skills from the shared skills list show as colored chips.',
      do: async ({ page, highlight }) => highlight(page.getByText('Cooking for large groups', { exact: true }).first()),
    },
    {
      say: 'A skill that is not on the list yet still shows, marked pending review, until an admin adds it.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Bulk food buying/).first()),
    },
  ],
};
