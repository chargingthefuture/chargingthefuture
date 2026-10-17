// Foundation: opens a provider's profile and points at Request Quote and Share without pressing
// either. Request Quote is not pressed because it notifies the provider. Reads only.
export default {
  slug: 'foundation-provider-profile',
  title: 'Foundation: a provider\'s profile',
  steps: [
    {
      say: 'Tap a provider to open their profile.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/foundation'));
        const card = page.getByText('Alex Rivera', { exact: true }).first();
        await card.waitFor({ timeout: 20_000 });
        await card.click();
        await page.getByText('Provider Profile', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'These are the skills they are willing to be contacted about.',
      do: async ({ page, highlight }) => highlight(page.getByText('Willing to be contacted about', { exact: true }).first()),
    },
    {
      say: 'Providers are fellow members, not a formally vetted service. Use your judgment.',
      do: async ({ page, highlight }) => highlight(page.getByText('Good to know', { exact: true }).first()),
    },
    {
      say: 'Request Quote asks them for help. It opens a private chat with that person, called the Direct Line.',
      do: async ({ button, highlight }) => highlight(button('Request Quote')),
    },
    {
      say: 'Share gives you a link to this profile, for another signed-in member.',
      do: async ({ button, highlight }) => highlight(button('Share')),
    },
  ],
};
