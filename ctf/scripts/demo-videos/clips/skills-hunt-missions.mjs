// SkillsHunt's Missions tab: what the open round still needs, counted across everybody. Uses the
// three demo missions from demo-seed/30-skills-hunt.mjs. Reads only; no write to the demo data.
export default {
  slug: 'skills-hunt-missions',
  title: 'SkillsHunt: missions',
  steps: [
    {
      say: 'The Missions tab shows what this round still needs.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/skills-hunt'));
        await button('Missions').click();
        await page.getByText('Find three skilled people', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Everyone in the round works toward the same missions, so every member sees the same numbers.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^What this round still needs\./)),
    },
    {
      say: 'This mission counts every accepted nomination. The bar shows how many it has of the three it needs.',
      do: async ({ page, highlight }) => highlight(page.getByText(/^\d+ of 3 nominated$/).first()),
    },
    {
      say: 'Nobody has started this one yet. The points beside it are the bonus for finishing it.',
      do: async ({ page, highlight }) => highlight(page.getByText('Find two rare skills', { exact: true }).locator('xpath=../..')),
    },
    {
      say: 'A locked mission opens later in the round. On an open one, Scout Now takes you to the form to nominate someone.',
      do: async ({ page, highlight }) => highlight(page.getByText('Technology sweep', { exact: true }).locator('xpath=../../..')),
    },
  ],
};
