// Contributor Access — the scored-members reading for the admin Weavers section (pure, no database).
//
// The weekly recompute stores each evaluated member's all-time score and gate readings in
// reason_snapshot. The admin list shows every member whose stored score is above zero, eligible or
// not, with how far each reading is from its setting, so a member below a gate is visible rather
// than absent. Admin only: no member surface reads this.

export type ScoredMember = {
  userId: string;
  username: string | null;
  score: number;
  accountAgeDays: number | null;
  distinctPlugins: number;
  counterparties: number;
  eligible: boolean;
  computedAt: string | null;
};

export type ScoredMemberGates = {
  threshold: number;
  minAccountAgeDays: number;
  minDistinctPlugins: number;
  minCounterparties: number;
};

export type ScoredMemberGaps = {
  pointsShort: number;
  daysShort: number | null;
  pluginsShort: number;
  counterpartiesShort: number;
};

function shortBy(value: number, needed: number): number {
  return Math.max(0, Math.round((needed - value) * 10) / 10);
}

// How far each reading is from its setting; 0 means that gate is met. Days short is null when the
// member's first sign-in is unknown, because the age gate cannot be met without it.
export function scoredMemberGaps(member: ScoredMember, gates: ScoredMemberGates): ScoredMemberGaps {
  return {
    pointsShort: shortBy(member.score, gates.threshold),
    daysShort: member.accountAgeDays == null ? null : shortBy(member.accountAgeDays, gates.minAccountAgeDays),
    pluginsShort: shortBy(member.distinctPlugins, gates.minDistinctPlugins),
    counterpartiesShort: shortBy(member.counterparties, gates.minCounterparties),
  };
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Reads one stored reason_snapshot into the fields the admin list shows.
export function readSnapshot(snapshot: unknown): Pick<ScoredMember, 'score' | 'accountAgeDays' | 'distinctPlugins' | 'counterparties'> {
  const raw = snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : {};
  const age = raw.accountAgeDays;
  return {
    score: numberOr(raw.score, 0),
    accountAgeDays: age == null ? null : numberOr(age, 0),
    distinctPlugins: numberOr(raw.distinctPlugins, 0),
    counterparties: numberOr(raw.counterparties, 0),
  };
}
