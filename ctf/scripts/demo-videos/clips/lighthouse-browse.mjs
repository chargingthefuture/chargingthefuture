// LightHouse: browse the housing listings and open one listing's detail. Makes no writes.
export default {
  slug: 'lighthouse-browse',
  title: 'LightHouse: browse listings',
  steps: [
    {
      say: 'LightHouse opens on the housing listings. Members list places to stay here, and every member can browse them.',
      speak: 'Light House opens on the housing listings. Members list places to stay here, and every member can browse them.',
      do: async ({ page, app }) => {
        await page.goto(app('/apps/lighthouse'));
        await page.getByText('Bright 1BR in Mission District').first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Each card shows the place, where it is, and the rent in its own currency.',
      do: async ({ page, highlight }) => highlight(page.getByText('Bright 1BR in Mission District').first()),
    },
    {
      say: 'Search by city, or filter to the places that accept ServiceCredits.',
      speak: 'Search by city, or filter to the places that accept Service Credits.',
      do: async ({ page, highlight }) => highlight(page.getByPlaceholder('City or neighborhood…')),
    },
    {
      say: 'Open a listing to see the full details.',
      do: async ({ page, button }) => {
        await button('View Bright 1BR in Mission District').click();
        await page.getByText('Listing Detail').first().waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Request to stay sends the host your request. The host sees your details only after you ask.',
      do: async ({ button, highlight }) => highlight(button('Request to stay')),
    },
  ],
};
