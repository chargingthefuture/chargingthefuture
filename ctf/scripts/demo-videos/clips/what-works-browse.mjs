// WhatWorks: browsing the shared list and searching it. No write to the demo data.
export default {
  slug: 'what-works-browse',
  title: 'WhatWorks: browse the list',
  steps: [
    {
      say: 'WhatWorks is a shared list of tools that survivors say help with specific problems.',
      speak: 'What Works is a shared list of tools that survivors say help with specific problems.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/what-works'));
        await page.getByRole('heading', { name: 'Voices through a shared wall drown out my work. How do I block them?' }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'The tools are grouped by problem.',
      do: async ({ page, highlight }) => highlight(page.getByRole('heading', { name: 'Voices through a shared wall drown out my work. How do I block them?' })),
    },
    {
      say: 'Each tool has a short note on why it works, and how many survivors found it helpful.',
      do: async ({ page, highlight }) => highlight(page.getByText(/survivors verified$/).first()),
    },
    {
      say: 'View product opens a link to get it.',
      do: async ({ page, highlight }) => highlight(page.getByRole('link', { name: /View product/ }).first()),
    },
    {
      say: 'Search narrows the list as you type.',
      do: async ({ page, highlight }) => {
        const search = page.getByLabel('Search tools or problems');
        await search.click();
        await search.pressSequentially('sleep', { delay: 60 });
        await page.getByText('Manta Sleep Mask', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(search);
      },
    },
  ],
};
