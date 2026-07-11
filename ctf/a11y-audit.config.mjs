import jsxA11y from 'eslint-plugin-jsx-a11y';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// Report-only static accessibility audit for the web app.
//
// Run it with: pnpm --dir ctf run lint:a11y
//
// It applies the jsx-a11y recommended rules over app/ and components/ to
// surface the statically-detectable WCAG 2.2 AA issues: missing or unbound
// labels, click handlers without keyboard handlers, interactive handlers on
// non-interactive elements, missing media captions, and missing required
// ARIA props.
//
// It is intentionally NOT wired into the blocking CI lint gate yet: doing so
// at "max warnings 0" would fail CI on the pre-existing findings this audit
// records. Enabling the blocking gate is the last step of the web
// accessibility work in issue #1432, after those findings are fixed.
//
// Limits: static analysis only. It does not check color contrast, focus
// order, keyboard traps, or screen-reader announcement behavior — those need
// the running app (axe) and the manual assistive-technology passes described
// in ctf/docs/developer/ACCESSIBILITY_STATEMENT.md.
export default [
  {
    files: ['**/*.{jsx,tsx}'],
    // Real disable directives (e.g. for @typescript-eslint rules this audit
    // does not enable) are valid under the app's own config; don't flag them.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    // @typescript-eslint is registered (no rules enabled) only so inline
    // eslint-disable comments referencing its rules resolve, keeping the
    // report to real jsx-a11y findings.
    plugins: { 'jsx-a11y': jsxA11y, '@typescript-eslint': tsPlugin },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
];
