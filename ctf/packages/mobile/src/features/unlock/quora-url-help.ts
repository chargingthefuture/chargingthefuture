// How to find a Quora profile URL: the steps and the picture from the web's
// lib/unlock/quora-url-help-steps.ts and public/help/quora-profile-url.svg, copied so the help box
// reads the same here. Keep them in step with the web files. The picture's <title> and <desc> are
// dropped (react-native-svg does not draw them); its text is the accessibility label instead.

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

export const QUORA_URL_HELP_IMAGE_ALT =
  'Illustration: on quora.com the profile address is in the browser bar and reads quora.com/profile/Your-Name; in the Quora app it comes from the ⋯ menu on your profile, under Share, Copy link.';

export const QUORA_URL_HELP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
  <rect width="640" height="400" rx="16" fill="#F7F5FB"/>

  <!-- Left phone: web browser -->
  <text x="160" y="30" text-anchor="middle" font-size="15" font-weight="700" fill="#2A2140">1. In a web browser</text>
  <rect x="60" y="44" width="200" height="330" rx="22" fill="#FFFFFF" stroke="#2A2140" stroke-width="3"/>
  <rect x="68" y="64" width="184" height="34" rx="8" fill="#FFF4C2" stroke="#C0841A" stroke-width="2.5"/>
  <text x="160" y="86" text-anchor="middle" font-size="11" fill="#2A2140">quora.com/profile/<tspan font-weight="700" fill="#B92B27">Your-Name</tspan></text>
  <circle cx="160" cy="146" r="28" fill="#E4DDF3"/>
  <circle cx="160" cy="138" r="10" fill="#9C8BC4"/>
  <path d="M142 162 q18 -18 36 0" fill="#9C8BC4"/>
  <text x="160" y="196" text-anchor="middle" font-size="14" font-weight="700" fill="#2A2140">Your Name</text>
  <rect x="84" y="214" width="152" height="10" rx="5" fill="#ECE8F4"/>
  <rect x="84" y="232" width="120" height="10" rx="5" fill="#ECE8F4"/>
  <rect x="84" y="250" width="140" height="10" rx="5" fill="#ECE8F4"/>
  <path d="M160 108 L160 100" stroke="#C0841A" stroke-width="2.5"/>
  <text x="160" y="300" text-anchor="middle" font-size="12" fill="#2A2140">Copy the address at the top.</text>
  <text x="160" y="318" text-anchor="middle" font-size="12" fill="#2A2140">It has /profile/ in it.</text>

  <!-- Right phone: Quora app -->
  <text x="480" y="30" text-anchor="middle" font-size="15" font-weight="700" fill="#2A2140">2. In the Quora app</text>
  <rect x="380" y="44" width="200" height="330" rx="22" fill="#FFFFFF" stroke="#2A2140" stroke-width="3"/>
  <circle cx="480" cy="110" r="28" fill="#E4DDF3"/>
  <circle cx="480" cy="102" r="10" fill="#9C8BC4"/>
  <path d="M462 126 q18 -18 36 0" fill="#9C8BC4"/>
  <text x="480" y="160" text-anchor="middle" font-size="14" font-weight="700" fill="#2A2140">Your Name</text>
  <rect x="534" y="66" width="32" height="24" rx="6" fill="#FFF4C2" stroke="#C0841A" stroke-width="2.5"/>
  <text x="550" y="83" text-anchor="middle" font-size="16" font-weight="700" fill="#2A2140">⋯</text>
  <rect x="420" y="186" width="140" height="92" rx="10" fill="#FFFFFF" stroke="#2A2140" stroke-width="1.5"/>
  <text x="436" y="212" font-size="13" fill="#2A2140">Share</text>
  <rect x="428" y="224" width="124" height="28" rx="6" fill="#FFF4C2" stroke="#C0841A" stroke-width="2.5"/>
  <text x="436" y="243" font-size="13" font-weight="700" fill="#2A2140">Copy link</text>
  <text x="436" y="270" font-size="13" fill="#6B6480">More…</text>
  <text x="480" y="300" text-anchor="middle" font-size="12" fill="#2A2140">Tap ⋯ on your profile,</text>
  <text x="480" y="318" text-anchor="middle" font-size="12" fill="#2A2140">then Share, then Copy link.</text>

  <text x="320" y="392" text-anchor="middle" font-size="10.5" fill="#6B6480">Illustration. Quora's screens may look a little different.</text>
</svg>`;
