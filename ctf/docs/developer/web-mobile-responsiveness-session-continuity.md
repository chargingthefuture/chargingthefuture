# Web mobile responsiveness — pragmatic reflow pass (session continuity)

## What this is

The v3 web app was built for desktop only. Its screens assume a wide window with a
fixed multi-column layout — a 72px icon rail, a fixed-width sidebar, the main
column, and a right rail. On a small phone screen (for example an iPhone SE at
375px wide) that row ran off the side of the screen, and because the page also
locked scrolling (`overflow: hidden` on `html, body`), the overflow was clipped
and could not be reached. The app was effectively unusable on a phone.

This pass makes the whole web app usable on a phone **without changing how it looks
on desktop**.

## Design-gate bypass (rule 127)

Making the app adapt to small screens is a layout change to user-facing screens,
which normally requires a design pass first (see
`.github/instructions/127-design-pass-gating-rules.mdc`). The design submodule only
holds desktop web designs; the narrow-screen `Mobile*` mockups there are scoped to
the Android app, not the web (per `ctf/agents/design.agent.md`), so there is no
authoritative responsive-web design to build against.

The owner approved a bypass on 2026-06-01: do a pragmatic reflow now so they can
test the app on their phone, keeping the existing desktop design and letting it
adapt to small screens. This note records the bypass as the rule requires.

Proper responsive-web designs from the Replit design agent remain a follow-up. When
they land, the per-screen polish listed below should be implemented against them
(see `.github/instructions/126-design-mockup-implementation-rules.mdc`).

## What changed

- `ctf/packages/web/app/globals.css`: on phones the document now scrolls normally
  instead of being locked to the viewport height with hidden overflow. This single
  change stops content from being clipped and unreachable. Desktop keeps the
  locked-viewport behavior so each shell still manages its own internal scrolling.
  A shared `.ctf-app-viewport` helper was added here too.
- `ctf/packages/web/app/apps/layout.tsx` and
  `ctf/packages/web/app/plugin/layout.tsx`: new wrappers that put every routed
  plugin screen inside `.ctf-app-viewport`. On phones this drops each plugin
  shell's fixed desktop row back to a normal vertical block, so the sections stack
  one under another and the page scrolls. It works without editing all ~24 plugin
  shells because a stylesheet rule marked `!important` overrides the plain inline
  styles those shells use. Desktop is untouched.
- `ctf/packages/web/components/community-shell/*`: the home screen and app launcher
  (used at both `/` and `/apps`) previously hid its icon rail and sidebar on small
  screens with nothing to replace them, leaving no way to navigate. It now shows a
  top bar on phones with the brand, a Chat/Apps switch, and a sign-in button or
  avatar, plus a menu button that slides the sidebar in as a drawer.

## Breakpoint

The phone treatment turns on below 768px wide. It is written with plain CSS media
queries (not Tailwind utility classes), so it does not depend on the Tailwind
version. The community shell keeps its existing 900px and 1280px breakpoints; its
new mobile top bar shows at 900px and below, matching where its rails were already
hidden.

## Known limits / follow-ups (gated on a responsive-web design pass)

These are intentionally left for a proper design pass rather than guessed at:

- On phones, plugin screens stack their side rails (icon rail, filter sidebar,
  right rail) above the main content, so you scroll past them to reach it.
  Per-plugin polish — collapsing the rails, putting the main content first, and
  placing right-rail content sensibly — needs a design.
- The community shell's right rail (profile card, quote, member list) is hidden on
  phones, as it already was below 1280px. Its key action (sign-in) is covered by
  the new top bar.
- Wide elements inside a plugin (for example data tables) may be clipped rather
  than made horizontally scrollable. Giving those their own scroll containers is a
  follow-up.

## How a future session should start

- Read `127-design-pass-gating-rules.mdc` and this note.
- Check the design submodule for responsive-web mockups. If they exist, implement
  the per-plugin mobile polish above against them.
- The shared mobile fallback lives in `app/globals.css` (`.ctf-app-viewport` plus
  the `html, body` media queries); the home-screen mobile nav lives in
  `components/community-shell/`.
