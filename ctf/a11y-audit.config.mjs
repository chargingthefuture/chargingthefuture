import jsxA11y from 'eslint-plugin-jsx-a11y';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// Static accessibility gate for the web app.
//
// Run it with: pnpm --dir ctf run lint:a11y
//
// It applies the jsx-a11y recommended rules over app/ and components/ to
// catch the statically-detectable WCAG 2.2 AA issues: missing or unbound
// labels, click handlers without keyboard handlers, interactive handlers on
// non-interactive elements, missing media captions, and missing required
// ARIA props.
//
// This is now a blocking CI check: the "Run web accessibility gate" step in
// the quality-gates job of .github/workflows/ci.yml runs `lint:a11y` at
// max-warnings 0, so a new violation fails the build. The few intentional
// exceptions that remain (modal backdrop click-to-close, the share-link
// popover's stopPropagation, and the not-yet-captioned Beacon replay video)
// carry an inline eslint-disable-next-line with a rationale at the call site;
// see ctf/docs/developer/ACCESSIBILITY_STATEMENT.md for the list. Do not add a
// blanket disable to silence a real finding — fix it or justify it per line.
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
