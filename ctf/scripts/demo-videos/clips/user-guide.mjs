// The public user guide. Needs no sign-in, so it is also the clip to run first when checking that
// the recorder itself works.
export default {
  slug: 'user-guide',
  title: 'The user guide',
  signIn: false,
  steps: [
    {
      say: 'Every part of the app has a section in the user guide, and reading it needs no account.',
      do: async ({ page, app }) => {
        await page.goto(app('/guide'));
        await page.waitForLoadState('networkidle');
      },
    },
    {
      say: 'Scroll to find a part, or open its section straight from a link.',
      do: async ({ scroll }) => scroll(900),
    },
    {
      say: 'This is the section for PeerProgramming.',
      speak: 'This is the section for Peer Programming.',
      do: async ({ page, app }) => {
        await page.goto(app('/guide#peer-programming'));
        await page.waitForLoadState('networkidle');
      },
    },
  ],
};
