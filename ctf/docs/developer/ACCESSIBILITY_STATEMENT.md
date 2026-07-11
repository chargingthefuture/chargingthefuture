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

Not yet audited. No formal WCAG 2.2 AA audit has been completed for either the web app or the Android
app as of 2026-07-11. Until an audit is complete, public claims are phrased as an aim ("built to WCAG
2.2 AA"), not a present-tense guarantee.

Update this line with the date and scope each time an audit runs (for example: "Web audited against
WCAG 2.2 AA on YYYY-MM-DD; Android audited on YYYY-MM-DD").

## Known gaps

Filled in from audit findings. Until the audits run, the honest statement is that gaps are not yet
enumerated:

- Web: no completed AA audit; per-criterion pass/fail not yet recorded.
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
6. Add automated gates so regressions cannot ship silently: `eslint-plugin-jsx-a11y` for web (CI,
   max warnings 0), an axe check in the end-to-end/CI path, a contrast-token check against the theme
   palette, and an equivalent React Native accessibility lint for mobile.
7. Manual assistive-technology passes on the core flows: VoiceOver/NVDA plus keyboard-only on web, and
   TalkBack on Android. Document each pass in a checklist.
8. Publish this statement as a public, rendered page the landing-page claim can point to, once the
   audits and gap list above are real.
