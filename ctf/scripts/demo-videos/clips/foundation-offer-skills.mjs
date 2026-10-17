// Foundation's Offer tab. Writes to the demo schema: saves the demo account's listing blurb, then
// turns one skill on and off again, so the account ends the clip offering nothing, as it started.
const BLURB = 'I help set up and check small TypeScript projects.';

export default {
  slug: 'foundation-offer-skills',
  title: 'Foundation: offer your skills',
  steps: [
    {
      say: 'The Offer tab is where you choose what people may contact you about.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/foundation'));
        await button('Offer').click();
        await page.getByText('Your listing blurb', { exact: true }).waitFor({ timeout: 20_000 });
        await page.getByText('Offer your skills', { exact: true }).waitFor({ timeout: 20_000 });
        // A run that stopped halfway can leave the skill on; start from off.
        const skill = page.getByRole('button', { name: /^TypeScript/ }).first();
        await skill.waitFor({ timeout: 20_000 });
        if (await skill.getByText('Offering', { exact: true }).count()) {
          await skill.click();
          await skill.getByText('Off', { exact: true }).waitFor({ timeout: 20_000 });
        }
      },
    },
    {
      say: 'Write one or two sentences about what you offer, then press Save.',
      do: async ({ page, button, highlight }) => {
        const box = page.getByPlaceholder('e.g. I help with resume reviews and mock interviews for tech roles.');
        await box.click();
        await box.fill('');
        await box.pressSequentially(BLURB, { delay: 30 });
        await button('Save').click();
        await page.getByText('Saved', { exact: true }).first().waitFor({ timeout: 20_000 });
        await highlight(box);
      },
    },
    {
      say: 'Below are the skills from your Directory profile. Turn one on, and you show up when someone searches for it.',
      do: async ({ page, highlight }) => {
        const skill = page.getByRole('button', { name: /^TypeScript/ }).first();
        await skill.click();
        await skill.getByText('Offering', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(skill);
      },
    },
    {
      say: 'Tap it again to stop. People only reach out to members who said yes.',
      do: async ({ page, highlight }) => {
        const skill = page.getByRole('button', { name: /^TypeScript/ }).first();
        await skill.click();
        await skill.getByText('Off', { exact: true }).waitFor({ timeout: 20_000 });
        await highlight(skill);
      },
    },
  ],
};
