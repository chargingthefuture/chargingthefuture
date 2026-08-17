// Platform-owned interface for the Recurring Activity capability (owner decision 2026-08-03: strict
// plugin isolation). This file is the single sanctioned crossing point for Recurring Activity:
// plugins must import it, never lib/recurring-activity directly. Keep it narrow — a new export needs
// a reason, and re-exporting whole modules is prohibited. Enforced by
// ctf/scripts/check-plugin-boundaries.mjs.
//
// GDP is the consumer today: it counts ongoing arrangements toward the economic picture, so it needs
// the cadence-to-monthly conversion and the list of origin plugins whose rows are counted per
// occurrence rather than per month.
export { PER_OCCURRENCE_ORIGIN_PLUGINS, cadenceMonthlyFactorSql } from 'lib/recurring-activity/types';
