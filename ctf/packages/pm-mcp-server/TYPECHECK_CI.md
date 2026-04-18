# TypeScript Type-Check CI Enforcement for pm-mcp-server

## Root Cause Documentation

- **Issue 1:** Missing function declaration in `src/tools/feedback.ts` caused fatal TypeScript syntax error.
- **Issue 2:** Misplaced code block in `src/index.ts` (erroneous `server.setRequestHandler` inside switch) broke compilation.

## Prevention Steps

- **Pre-commit hook:** Added `.husky/pre-commit` to enforce `pnpm run type-check` before every commit. Commits are blocked if type-check fails.
- **CI Recommendation:** Add a CI workflow step to run `pnpm run type-check` for `pm-mcp-server` on every PR and push.
- **Reviewer Policy:** Recommend configuring the Architecture & Coding Standards agent as a required reviewer for all changes to this package.

## How to Fix Similar Issues

- Always run `pnpm run type-check` locally before committing or pushing changes.
- Review all switch/case and function declarations for completeness and correct placement.
- Use parameterized queries and consistent typing for all tool functions.

## Future Improvements

- Add Zod or similar runtime validation for all tool input.
- Expand CI to run full test suite and lint checks.
- Automate agent review for architectural and coding standards compliance.
