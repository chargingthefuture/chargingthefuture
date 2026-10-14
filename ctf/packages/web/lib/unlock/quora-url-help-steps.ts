// How to find a Quora profile URL, written once and used in two places: the "Show me where to find
// it" steps inside the help box (components/unlock/unlock-quora-help.tsx, on the Unlock screen and in
// the Commons banner) and the scripted @comic answer (lib/comic/unlock-help-script.ts). The member
// reading the box and the member asking @comic must be told the same thing, so neither keeps its own
// copy.
//
// Each case is one way members actually get stuck: they are on the Quora app, which has no address
// bar; they are in a browser and do not know which page is "the profile"; they pasted a link to an
// answer or a Space instead of the profile; or they cannot get into their Quora account at all. Pure
// data with no imports, so a client component can use it.

export type QuoraUrlHelpCase = 'browser' | 'quora_app' | 'wrong_link' | 'cannot_sign_in';

export type QuoraUrlHelpSteps = {
  heading: string;
  steps: readonly string[];
};

export const QUORA_URL_HELP_STEPS: Record<QuoraUrlHelpCase, QuoraUrlHelpSteps> = {
  browser: {
    heading: 'In a web browser',
    steps: [
      'Open quora.com and sign in.',
      'Tap your profile picture, then tap your name. This opens your profile page.',
      'The address at the top of the browser is your profile URL. It looks like https://www.quora.com/profile/Your-Name.',
      'Copy that address and paste it into the Quora profile URL box, at the top of the Commons or on the Unlock screen.',
    ],
  },
  quora_app: {
    heading: 'In the Quora app',
    steps: [
      'The app has no address bar, so the link comes from the share button.',
      'Tap your profile picture, then tap your name to open your profile.',
      'Tap the three dots (⋯) on your profile, then Share, then Copy link.',
      'Paste it into the Quora profile URL box, at the top of the Commons or on the Unlock screen. Extra text after a question mark is fine; it is ignored.',
    ],
  },
  wrong_link: {
    heading: 'If your link was not accepted',
    steps: [
      'The link must be your profile, the one with /profile/ in it. A link to an answer, a question or a Space will not work.',
      'Open any answer you wrote and tap your own name at the top of it. That opens your profile.',
      'Copy the address of that page. It looks like https://www.quora.com/profile/Your-Name.',
    ],
  },
  cannot_sign_in: {
    heading: 'If you cannot get into your Quora account',
    steps: [
      'Your account here stays as it is while this step is unfinished, for as long as it takes.',
      'In the "Anything that helps me find you on Quora" box, write the name on your Quora account, the email you joined Quora with, or a link to anything you posted.',
      'A person uses that to look you up and can approve you by hand.',
    ],
  },
};

// The order the help box lists them in: the two ways to find it, then the two ways it goes wrong.
export const QUORA_URL_HELP_ORDER: readonly QuoraUrlHelpCase[] = ['browser', 'quora_app', 'wrong_link', 'cannot_sign_in'];

// The picture shown beside the steps. An illustration rather than a capture of Quora's own screens,
// so it names no real account and does not go out of date the moment Quora moves a button.
export const QUORA_URL_HELP_IMAGE = {
  src: '/help/quora-profile-url.svg',
  alt: 'Illustration: on quora.com the profile address is in the browser bar and reads quora.com/profile/Your-Name; in the Quora app it comes from the ⋯ menu on your profile, under Share, Copy link.',
} as const;
