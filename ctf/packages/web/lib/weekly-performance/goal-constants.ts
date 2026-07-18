// The two platform goals the Weekly Performance dashboard tracks progress toward
// (owner-set, 2026-07-18 — see ctf/docs/developer/PLUGIN_VALUE_METRICS.md). Pure constants with no
// imports so both the server metric computation and the client dashboard can use them.

// GDP Community Value Index goal — an index-point estimate, never money or a price.
export const GDP_VALUE_INDEX_GOAL = 300_000_000_000;

// Workforce recruited goal — members with an active Directory presence.
export const WORKFORCE_RECRUITED_GOAL = 2_000_000;

export const GOAL_TARGETS: Record<string, number> = {
  'goal.gdp_value_index': GDP_VALUE_INDEX_GOAL,
  'goal.workforce_recruited': WORKFORCE_RECRUITED_GOAL,
};
