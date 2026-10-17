// SkillUp: the Wallet tab, a read-only view of the demo account's credits. Makes no writes.
export default {
  slug: 'skill-up-wallet',
  title: 'SkillUp: your credits',
  steps: [
    {
      say: 'The Wallet tab shows your credits in SkillUp. Credits are not money.',
      speak: 'The Wallet tab shows your credits in Skill Up. Credits are not money.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/skill-up'));
        await button('Wallet').waitFor({ timeout: 20_000 });
        await button('Wallet').click();
        await page.getByText('In escrow', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Available is what you hold right now.',
      do: async ({ page, highlight }) => highlight(page.getByText('Available', { exact: true }).first()),
    },
    {
      say: 'In escrow is your deposit, held in the cohorts you joined until each milestone is signed off.',
      do: async ({ page, highlight }) => highlight(page.getByText('In escrow', { exact: true })),
    },
    {
      say: 'This screen only shows your credits. Nothing is sent or transferred from here.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^SkillUp is earn-only\./)),
    },
    {
      say: 'The buttons above the list narrow it. Escrow shows only your deposits.',
      do: async ({ button, highlight }) => highlight(button('Escrow')),
    },
  ],
};
