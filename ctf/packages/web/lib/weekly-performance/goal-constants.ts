// The platform goal the Weekly Performance dashboard tracks progress toward (owner-set,
// 2026-07-18 — see ctf/docs/developer/PLUGIN_VALUE_METRICS.md). The GDP Community Value Index goal
// left this dashboard on 2026-11-02; the GDP plugin shows it on its own tile. Pure constants with no
// imports so both the server metric computation and the client dashboard can use them.

// Workforce recruited goal — members with an active Directory presence.
export const WORKFORCE_RECRUITED_GOAL = 2_000_000;

export const GOAL_TARGETS: Record<string, number> = {
  'goal.workforce_recruited': WORKFORCE_RECRUITED_GOAL,
};
