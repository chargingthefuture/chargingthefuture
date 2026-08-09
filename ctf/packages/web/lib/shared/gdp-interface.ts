// Platform-owned interface for the GDP capability (owner decision 2026-08-03: strict plugin
// isolation). This file is the single sanctioned crossing point for GDP: plugins must import it,
// never lib/gdp directly. Keep it narrow — a new export needs a reason, and re-exporting the
// whole repository is prohibited. Enforced by ctf/scripts/check-plugin-boundaries.mjs.
export { buildLiveGdpReport } from 'lib/gdp/repository';
