// LightHouse: the List tab and the form for listing a place. Opens the form but does not publish,
// so it makes no writes.
export default {
  slug: 'lighthouse-list-your-place',
  title: 'LightHouse: list your place',
  steps: [
    {
      say: 'Have a place to offer? Open the List tab. There is no separate host profile to fill in.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/lighthouse'));
        await button('List').waitFor({ timeout: 20_000 });
        await button('List').click();
        await page.getByText('You are listing as', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Seekers see your name, your Quora profile, and your Trust signals.',
      do: async ({ page, highlight }) => highlight(page.getByText('You are listing as', { exact: true })),
    },
    {
      say: 'Press List your place to open the form.',
      do: async ({ page, button }) => {
        await button('List your place').click();
        await button('Publish listing').waitFor({ timeout: 20_000 });
        await page.getByText('Title *', { exact: true }).scrollIntoViewIfNeeded();
      },
    },
    {
      say: 'Give it a title and a description, then the type of place, where it is, and the rent.',
      do: async ({ page, highlight }) => highlight(page.getByText('Title *', { exact: true })),
    },
    {
      say: 'Choose whether it accepts ServiceCredits.',
      speak: 'Choose whether it accepts Service Credits.',
      do: async ({ page, highlight }) => highlight(page.getByText('Accepted currencies', { exact: true })),
    },
    {
      say: 'Publish listing puts it in the listings right away. No approval step.',
      do: async ({ button, highlight }) => highlight(button('Publish listing')),
    },
  ],
};
