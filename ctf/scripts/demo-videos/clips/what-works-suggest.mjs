// WhatWorks: suggesting a tool. Submits one suggestion to the demo schema on every run; it waits
// for review there and does not appear on the list.
export default {
  slug: 'what-works-suggest',
  title: 'WhatWorks: suggest a tool',
  steps: [
    {
      say: 'To add a tool that worked for you, press Suggest an item.',
      do: async ({ page, app, button, highlight }) => {
        await page.goto(app('/apps/what-works'));
        await button('Suggest an item').waitFor({ timeout: 20_000 });
        await highlight(button('Suggest an item'));
      },
    },
    {
      say: 'Pick the problem it solves. New problems are added by admins, so the list has no duplicates.',
      do: async ({ page, button, highlight }) => {
        await button('Suggest an item').click();
        await page.getByText('Suggest a tool that worked.', { exact: true }).waitFor({ timeout: 20_000 });
        const problem = page.locator('select').first();
        await problem.selectOption({ label: 'Sleep Disruption' });
        await highlight(problem);
      },
    },
    {
      say: 'Give the product name, a direct link to get it, and a short note if you want.',
      do: async ({ page, highlight }) => {
        await page.getByPlaceholder('e.g. Sony WH-1000XM5 Headphones').pressSequentially('Foam ear plugs', { delay: 35 });
        await page.getByPlaceholder('https://…').pressSequentially('https://duckduckgo.com/?q=foam+ear+plugs', { delay: 20 });
        const note = page.getByPlaceholder('A short note from your experience — what it actually solved.');
        await note.pressSequentially('Cheap, and enough to fall asleep with.', { delay: 35 });
        await highlight(note);
      },
    },
    {
      say: 'Press Submit for review.',
      do: async ({ button, highlight }) => highlight(button('Submit for review')),
    },
    {
      say: 'A reviewer checks it before it joins the shared list.',
      do: async ({ page, button }) => {
        await button('Submit for review').click();
        await page.getByText('Suggestion submitted 🎉', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
  ],
};
