# Accessibility statement

This is the source of truth for the product's accessibility target and its current, honest status.
Any public accessibility claim — on the landing page, in marketing, or inside the app — must point
back to this document. Keep the "last tested" date and the "known gaps" list current; a claim is only
as honest as the dated status behind it.

## Target

WCAG 2.2 Level AA, for both the web app and the Android app.

Owner decision, 2026-07-11 (issue #1432): AA is the target we make and maintain. It is the achievable,
auditable, legally-recognized bar — the standard referenced by the ADA effective standard, Section
508, and EN 301 549. We do not claim Level AAA as a blanket guarantee: WCAG 2.2 advises against
requiring AAA across an entire site, and several AAA criteria cannot be met for the live and recorded
audio-video features (for example 1.2.6 Sign Language, 1.2.9 Audio-only (Live), and 1.4.6 Contrast
7:1 across the whole palette).

Where the product can meet an individual AAA success criterion without constraining the whole
experience, it does — for example 7:1 contrast on primary text and a 6th-grade reading level per the
brand voice. These are enhancements on top of the AA target, not part of the public claim.

## What we have today

- Web: broad use of semantic roles and `aria-*` attributes across components, a shared accessible-forms
  standard (`ctf/docs/developer/ACCESSIBLE_FORMS_STANDARD.md`), and contrast tokens in the theme.
- Android (React Native): accessibility props (`accessibilityLabel`, `accessibilityRole`,
  `accessible`) on some, but not all, screens.

## Last tested

- Web, static scan: 2026-07-11. A repeatable static accessibility scan (`pnpm --dir ctf run
  lint:a11y`, `eslint-plugin-jsx-a11y` recommended rules over `packages/web/app` and
  `packages/web/components`) ran over 338 component files. The first run found 66 issues; after fixing
  the label-association issues (25) and the keyboard-operability issues (28), 13 remain. This is the
  statically-detectable subset only; it does not cover contrast, focus order, keyboard traps, or
  screen-reader behavior.
- Web, full runtime audit: not yet run (axe sweep of every route + manual review).
- Android: not yet audited.

Until the full runtime audits are complete, public claims are phrased as an aim ("built to WCAG 2.2
AA"), not a present-tense guarantee. Update these lines with the date and scope each time a scan or
audit runs.

## Known gaps

Filled in from audit findings.

- Web (from the 2026-07-11 static scan; 66 issues found, 13 remaining):
  - Fixed: all 25 controls where a label was not programmatically tied to its input
    (`jsx-a11y/label-has-associated-control`) — native inputs now use `htmlFor`/`id`, custom
    select components take an `id`, group captions no longer misuse `<label>`, and two wrapping
    labels gained an explicit control name.
  - Fixed: 28 keyboard-operability issues — 10 clickable cards/list rows/filters became keyboard
    operable (`role="button"`, `tabIndex`, and an Enter/Space handler); three modal dialogs
    (Chyme tip, directory profile edit, Foundation connect-now) gained close-on-Escape and dropped an
    unneeded inner click handler; a redundant `role="region"` was removed; and a listbox option got
    its required `aria-selected`.
  - Remaining (13), each with a rationale:
    - 5 modal backdrops still show a click-to-close handler on the dialog element
      (`click-events-have-key-events` + `no-noninteractive-element-interactions`): Chyme tip,
      directory profile edit, Foundation connect-now, comic-consent, bug-report. Each has a real
      keyboard path — Escape closes and a visible close button is present — so the backdrop click is a
      mouse convenience, not a barrier.
    - 1 share-link popover keeps a `stopPropagation` click handler to stop an outside-click-close from
      firing on its own content; it is event management, not a user action, and its controls are
      focusable buttons.
    - 1 recorded video in the Beacon replay view has no captions track
      (`jsx-a11y/media-has-caption`). This is a genuine WCAG 1.2.2 gap: captions are not produced for
      recorded broadcasts yet, so a captions pipeline is needed rather than an empty track.
  - Not yet measured (needs the runtime audit): contrast, focus order, keyboard traps, and
    screen-reader announcements.
- Android: no completed AA audit; a meaningful share of screens still lack accessibility props, and
  no assistive-technology (TalkBack) pass has been documented.

## How to report an accessibility problem

Report an accessibility barrier the same way as any other bug (see
`.claude/rules/129-bug-reporting-and-triage-rules.mdc`). Include the screen, what you were trying to
do, the assistive technology in use (screen reader, keyboard only, magnifier), and what went wrong.
Accessibility reports are triaged as user-facing defects, not cosmetic requests.

## Ownership and re-test cadence

- Owner: accessibility target and this statement are owned by the product owner; a named maintainer is
  assigned when the first audit is scheduled.
- Every pull request: automated accessibility checks run in CI once the gates below are in place, so
  regressions cannot ship silently.
- Every release (or quarterly, whichever comes first): re-run the manual audit on the core flows and
  update the "last tested" date and "known gaps" here. An accessibility line is part of the manual
  test and release checklist.

## Remaining work to make the claim fully honest (issue #1432)

Ordered; later items depend on earlier ones.

1. Reconcile the internal target so rule 100 and the accessible-forms standard both state AA baseline
   with AAA enhancements where feasible. Done in this change.
2. Audit the web app against WCAG 2.2 AA: automated (axe) sweep of every route plus manual review;
   record failures per success criterion.
3. Audit the Android app against WCAG 2.2 AA via WCAG2ICT mapping (satisfied through React Native
   accessibility APIs plus TalkBack, not `aria-*`); cover the screens with no accessibility props.
4. Fix the web gaps found in step 2 (labels, roles, focus order, contrast, keyboard traps, form
   errors).
5. Fix the Android gaps found in step 3 (accessibility labels/roles/state on interactive elements,
   focus order, contrast, touch-target size, TalkBack announcements).
6. Add automated gates so regressions cannot ship silently. Started: a report-only static scan exists
   (`pnpm --dir ctf run lint:a11y`, config `ctf/a11y-audit.config.mjs`). Still to do: wire
   `eslint-plugin-jsx-a11y` into the blocking CI lint gate at max warnings 0 (only after the web gaps
   above are fixed), add an axe check in the end-to-end/CI path, a contrast-token check against the
   theme palette, and an equivalent React Native accessibility lint for mobile.
7. Manual assistive-technology passes on the core flows: VoiceOver/NVDA plus keyboard-only on web, and
   TalkBack on Android. Document each pass in a checklist.
8. Publish this statement as a public, rendered page the landing-page claim can point to, once the
   audits and gap list above are real.
