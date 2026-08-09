// Platform-owned interface for the Workforce capability (owner decision 2026-08-03: strict plugin
// isolation). This file is the single sanctioned crossing point for Workforce: plugins must import
// it, never lib/workforce directly. Keep it narrow — a new export needs a reason, and re-exporting
// the whole repository is prohibited. Enforced by ctf/scripts/check-plugin-boundaries.mjs.
export { fetchOccupationGapReport } from 'lib/workforce/repository';
