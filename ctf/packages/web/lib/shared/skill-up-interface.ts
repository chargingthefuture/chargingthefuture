// Platform-owned interface for the SkillUp capability (owner decision 2026-08-03: strict plugin
// isolation). This file is the single sanctioned crossing point for SkillUp: plugins must import it,
// never lib/skill-up directly. Keep it narrow — a new export needs a reason, and re-exporting the
// whole repository is prohibited. Enforced by ctf/scripts/check-plugin-boundaries.mjs.
//
// The one crossing today: Directory records skill changes on claimed profiles so SkillUp's trainer
// claim gate has an audit trail behind it (owner decision 2026-08-29).
export { recordTrainerSkillChanges, type TrainerSkillChange } from 'lib/skill-up/trainer-claim';
