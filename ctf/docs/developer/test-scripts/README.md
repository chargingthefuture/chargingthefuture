# Manual Test Scripts

This folder holds one **manual test script** per plugin: the steps to walk on a real device
(usually a phone) to confirm the plugin actually works. They exist because the app is large and a
single change can break something far from where you were working — these scripts let you do a real
testing sweep instead of only spot-checking what you just touched.

## Native Android is now Chyme-only — see `android-app-test-script.md`

The native Android app is narrowed to Chyme plus a small keep-list (Clerk sign-in, Chyme live audio,
bug reporting, settings/account) — owner decision 2026-07-20, rule 105. So the per-plugin scripts
below are now **web** test scripts (those features live on the installable web app, not on Android).
The whole native app is covered instead by one dedicated script:
[`android-app-test-script.md`](./android-app-test-script.md). Run that before every Android release —
its background-audio step (AN-4 / CH-10) can only be confirmed on a real device build.

## Why manual, and why not a browser-driver tool

The repo deliberately avoids third-party UI test tools (Selenium and the like). They are hard to run
against this app and useless when you are testing from a phone. Instead an agent keeps these scripts
current and **you** execute them.

These scripts are the runtime counterpart to the **code-review sweep**
(`.github/workflows/code-review-sweep.yml`). Same source of truth — each plugin's feature inventory
and contracts — but a different job:

- **Code review** reads the static code and files `code-review` issues an agent can fix.
- **Manual test scripts** describe what to do in the running app. They catch what code review can't
  see: a control that renders off-screen at phone width, a 500 from the live Clerk/Stream/Formance
  integration, seed data that doesn't render, a flow that breaks only when many correct pieces
  combine, or a web-vs-android parity gap.

A code-review finding exists the moment the agent reasons about the code. A manual-test finding only
exists once you run the step — so these files are a checklist for you, and a failed step becomes a
row in the **Bug Reporting** plugin (put the bug link in the step's notes line so the next run knows
it's already filed).

## How a script is produced

`ctf/scripts/generateManualTestScript.mjs` reads the plugin's row in
`ctf/config/manual-test-script-manifest.json`, then its feature inventory and declared contracts, and
writes `<slug>-test-script.md`. The manifest is the one place the irregular
slug ↔ inventory ↔ code-folder ↔ role mapping is pinned down (e.g. slug `gdp` ↔ inventory
`gross-domestic-product`, api dir `bug-reports` ↔ slug `bug-reporting`).

## Two triggers (same generator)

1. **Auto (rotation).** The daily code-review sweep reviews one plugin per run; right after it, the
   workflow regenerates that same plugin's test script (`TEST_SCRIPT_FROM_REVIEW=1`). Over time every
   plugin's script stays current with no action from you. One rotation, two artifacts.

2. **On demand.** Run it yourself when you just changed something:

   ```bash
   # one plugin
   pnpm --dir ctf test-script:generate -- service-credits

   # every plugin touched since a base ref (the "what should I re-test" path)
   TEST_SCRIPT_DIFF=origin/main pnpm --dir ctf test-script:generate

   # all plugins
   TEST_SCRIPT_ALL=1 pnpm --dir ctf test-script:generate
   ```

   The same thing runs in CI from `.github/workflows/manual-test-script.yml` (dispatch by hand with a
   `slice`, a `diff_base`, or `all`). The generator needs `ANTHROPIC_API_KEY` (injected from
   Infisical in CI, exactly like the review sweep); with no key it does nothing.

Rotation alone is too slow to answer "did my last change break this" — it might not reach that plugin
for weeks. The on-demand trigger covers that; rotation keeps the long tail from going out of date.

## Running a sweep

- **Every session:** run each script's **Core smoke** block. Short, highest-risk first.
- **After a change:** regenerate the touched plugins (diff mode) and run their full walkthrough.
- **Before a release:** run all of them.

Each case is tagged by **role** (member / admin) and **surface** (web desktop, web mobile-responsive
at ~390px, android), because not every plugin is tested as a logged-in member: most are member-facing,
`weekly-performance` is admin-only, and `unlock` / `trust` / `bug-reporting` are internal surfaces
tested through their admin/internal entry points.

## Accessibility check (every sweep)

The product's accessibility target is WCAG 2.2 Level AA — see
`../ACCESSIBILITY_STATEMENT.md`. On each sweep, and before every release, run this short check on the
core flow you are testing and file any failure as a Bug Reporting row:

- Keyboard only (web): tab through the flow. Every control is reachable, the focus ring is always
  visible, focus order is logical, and focus moves to errors and dialogs when they open. No keyboard
  trap.
- Screen reader spot-check: VoiceOver or NVDA on web, TalkBack on android. Every control announces a
  clear label (including icon-only buttons: share, copy, close, back), and loading/success/error
  states are announced, not only shown.
- Contrast and non-color cues: text and meaningful UI are readable against the theme; meaning is never
  carried by color alone.
- Touch targets on android and mobile-responsive web are at least 44×44px.

This is a manual AA spot-check, not a full audit. The full per-route audit and the automated
accessibility gates are tracked in issue #1432 and listed in `../ACCESSIBILITY_STATEMENT.md`.
