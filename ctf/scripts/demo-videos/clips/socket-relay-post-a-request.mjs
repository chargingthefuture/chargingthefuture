// SocketRelay's Post tab: fills in a request with two tags, left as free, and posts it. Writes one
// open request to the demo data on every run; it leaves the feed after 28 days.
export default {
  slug: 'socket-relay-post-a-request',
  title: 'SocketRelay: post a request',
  steps: [
    {
      say: 'SocketRelay is where you ask for help with a task or a favor. The Post tab opens the form.',
      speak: 'Socket Relay is where you ask for help with a task or a favor. The Post tab opens the form.',
      do: async ({ page, app, button }) => {
        await page.goto(app('/apps/socket-relay'));
        await button('Post').waitFor({ timeout: 20_000 });
        await button('Post').click();
        await page.getByLabel('Title', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
    {
      say: 'Give it a short title, then say what you need.',
      do: async ({ page, highlight }) => {
        const title = page.getByLabel('Title', { exact: true });
        await title.click();
        await title.pressSequentially('Ride to the pharmacy on Thursday', { delay: 35 });
        const details = page.getByLabel('Details', { exact: true });
        await details.click();
        await details.pressSequentially('Need a lift across town and back, about an hour.', { delay: 25 });
        await highlight(title);
      },
    },
    {
      say: 'Add up to three tags, so helpers can find it.',
      do: async ({ page, highlight }) => {
        const tags = page.getByLabel('Tags (up to 3)', { exact: true });
        await tags.click();
        await tags.pressSequentially('Rides', { delay: 35 });
        await tags.press('Enter');
        await tags.pressSequentially('Errands', { delay: 35 });
        await tags.press('Enter');
        await highlight(tags.locator('..'));
      },
    },
    {
      say: 'Most help here is free. You can also settle in ServiceCredits, money, or a barter.',
      speak: 'Most help here is free. You can also settle in Service Credits, money, or a barter.',
      do: async ({ page, highlight }) => highlight(page.getByLabel('How will this be settled?').first()),
    },
    {
      say: 'Press Post Request.',
      do: async ({ button, highlight }) => highlight(button('Post Request')),
    },
    {
      say: 'Your request is on the feed for 28 days. When someone offers to help, a private Direct Line opens between you.',
      do: async ({ page, button }) => {
        await button('Post Request').click();
        await page.getByText('Posted successfully! View it in the feed.', { exact: true }).waitFor({ timeout: 20_000 });
      },
    },
  ],
};
