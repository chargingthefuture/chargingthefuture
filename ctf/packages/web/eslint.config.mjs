import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  {
    ignores: ['.next/**', 'node_modules/**'],
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      // Registered so inline `eslint-disable-next-line jsx-a11y/...` directives resolve in this base
      // lint. No jsx-a11y rules are enabled here — accessibility is enforced by the separate
      // `lint:a11y` gate (ctf/a11y-audit.config.mjs); this only stops "rule not found" errors on the
      // justified disables in component files.
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...(tsPlugin.configs.recommended.rules || {}),
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
