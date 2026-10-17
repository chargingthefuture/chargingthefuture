// Books the last open slot on the TI Radio guide, then gives it back, so the demo schedule ends the
// clip as it started. Writes one booking to the demo data and removes it again.
const SUBJECT = 'Night shift, and how we get through it';

export default {
  slug: 'ti-radio-host-a-slot',
  title: 'TI Radio: hosting a slot',
  steps: [
    {
      say: 'TI Radio is a week of live discussions, 90 minutes each. Members host them, and everyone meets in Chyme.',
      speak: 'T I Radio is a week of live discussions, 90 minutes each. Members host them, and everyone meets in Chyme.',
      do: async ({ page, app }) => {
        await page.goto(app('/ti-radio'));
        await page.getByRole('button', { name: 'Host this slot', exact: true }).last().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'An open slot says Host this slot. Any approved member can take one. First come, first served.',
      do: async ({ page, highlight }) => highlight(page.getByRole('button', { name: 'Host this slot', exact: true }).last()),
    },
    {
      say: 'Write what the discussion is about. The day and time come from the row you pressed.',
      do: async ({ page, highlight }) => {
        await page.getByRole('button', { name: 'Host this slot', exact: true }).last().click();
        const subject = page.getByLabel('What is it about?');
        await subject.waitFor({ timeout: 20_000 });
        await subject.pressSequentially(SUBJECT, { delay: 35 });
        await highlight(subject);
      },
    },
    {
      say: 'Your handle and what you write go on the public guide, which anyone can read without an account.',
      do: async ({ page, highlight }) => highlight(page.getByText(/Your handle and what you wrote here go on the public guide/)),
    },
    {
      say: 'Press Take this slot. It is yours, and your handle and subject show on that row.',
      do: async ({ page, button, highlight }) => {
        await button('Take this slot').click();
        const giveBack = page.getByRole('button', { name: 'Give this slot back', exact: true }).last();
        await giveBack.waitFor({ timeout: 20_000 });
        await highlight(page.getByText(SUBJECT, { exact: true }).last());
      },
    },
    {
      say: 'Changed your mind? Give this slot back before it starts, and it is open again.',
      do: async ({ page }) => {
        const giveBack = page.getByRole('button', { name: 'Give this slot back', exact: true }).last();
        await giveBack.scrollIntoViewIfNeeded();
        page.once('dialog', (dialog) => dialog.accept());
        await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/ti-radio/slots/') && r.request().method() === 'DELETE', { timeout: 20_000 }),
          giveBack.click(),
        ]);
        await page.waitForLoadState('networkidle');
      },
    },
  ],
};
