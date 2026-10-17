// Knowledge Library at /knowledge: the default way to lend Quora writing, and the six consent lines.
// Ticks the boxes on screen only; never presses Send my writing, so nothing is stored.
export default {
  slug: 'comic-lend-your-writing',
  title: 'Knowledge Library: lend your writing',
  steps: [
    {
      say: 'Knowledge Library is where you lend your own public Quora writing to the assistant, so it can answer from more than one person\'s experience.',
      do: async ({ page, app }) => {
        await page.goto(app('/knowledge'));
        await page.getByText('How you want to send it', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Pick a few posts is selected for you. For each post you paste its Quora link and its text. Nothing ever opens the link.',
      do: async ({ page, highlight }) => highlight(page.getByText('Pick a few posts (recommended)', { exact: true })),
    },
    {
      say: 'Until you tick all six consent lines, the boxes for your posts stay switched off.',
      do: async ({ page, highlight }) => highlight(page.getByText('Tick all six consent lines above to add your posts.', { exact: true })),
    },
    {
      say: 'Each line has its own box, and there is no single agree to all. Read each one and tick it.',
      do: async ({ page, pause }) => {
        const consent = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Your consent' }) });
        await consent.scrollIntoViewIfNeeded();
        const boxes = consent.getByRole('checkbox');
        const count = await boxes.count();
        for (let i = 0; i < count; i += 1) {
          await boxes.nth(i).scrollIntoViewIfNeeded();
          await boxes.nth(i).check();
          await pause(0.3);
        }
      },
    },
    {
      say: 'Now the boxes switch on. Paste a post\'s link and its full text, and use Add another post for each one after that.',
      do: async ({ page, highlight }) => highlight(page.getByPlaceholder('Paste the entire post here').first()),
    },
    {
      say: 'Send my writing sends it to be read by a person. You can withdraw it later from this same page.',
      do: async ({ button, highlight }) => highlight(button('Send my writing')),
    },
  ],
};
