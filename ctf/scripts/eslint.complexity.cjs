// Minimal ESLint config used ONLY by the modularity/complexity gate
// (check-modularity-governance.sh). It intentionally loads NO plugins and no
// other rules — just the TypeScript parser (so .ts/.tsx parse) plus the two
// rule-116 limits — so the gate enforces complexity and function length and
// nothing else. Run via `eslint --no-eslintrc -c` so the project's full ruleset
// (and its sanctioned inline disables, e.g. approved @typescript-eslint/no-explicit-any)
// never affect this gate, and files with jsx-a11y disable comments don't error as
// "rule not found".
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  rules: {
    complexity: ['error', 10],
    'max-lines-per-function': ['error', { max: 200, skipBlankLines: true, skipComments: true, IIFEs: true }],
  },
};
