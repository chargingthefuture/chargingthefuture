// ClickLog: the incident list, its sharing controls, and the editor. Opens the editor and cancels
// it; nothing is changed. No write to the demo data.
export default {
  slug: 'click-log-history',
  title: 'ClickLog: your incident list',
  steps: [
    {
      say: 'Your incidents are listed under the form, newest first.',
      do: async ({ page, app, highlight }) => {
        await page.goto(app('/apps/click-log'));
        const heading = page.getByText('Recent Incidents', { exact: true });
        await heading.waitFor({ timeout: 20_000 });
        await highlight(heading);
      },
    },
    {
      say: 'Each one says Private or Shared with owner. On an incident with no tags, tap it to change your mind at any time.',
      do: async ({ page, highlight }) => highlight(page.locator('button', { hasText: /^(Private|Shared with owner)$/ }).first()),
    },
    {
      say: 'This box shares new incidents with the owner by default. It starts off, and it never shares your notes.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^Share new incidents with the owner by default/).first()),
    },
    {
      say: 'The pencil edits the note and tags. The date and location stay as logged.',
      do: async ({ page, button, highlight }) => {
        await button('Edit incident').click();
        await highlight(page.getByText(/stay as logged/).first());
      },
    },
    {
      say: 'Cancel closes the editor without saving.',
      do: async ({ button }) => {
        await button('Cancel').click();
        await button('Edit incident').waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'The bin deletes an incident. It asks you first.',
      do: async ({ button, highlight }) => highlight(button('Delete incident')),
    },
  ],
};
