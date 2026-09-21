// Contributor Access — value-event keys and default weights.
//
// The thirteen `value.*` event keys are the events that count as giving something. They began as a
// mirror of lib/weekly-performance/live-metrics.ts (the decision record
// ctf/docs/developer/PLUGIN_VALUE_METRICS.md) and no longer match it exactly. Two were removed on
// 2026-09-20, for one reason: the measure these keys feed separates people who give from people who
// only register an opinion, and somebody extracting rather than giving would otherwise accrue
// points for turning up.
//
//   * Beacon broadcast engagement. Reacting to or replying under a broadcast is talk.
//   * WhatWorks endorsements. An endorsement is one "this helped me" mark per member per tool — an
//     upvote. In WhatWorks the thing of value is the recommendation itself: somebody lists a tool
//     or resource and others mark whether it worked. So the listing is what is weighted
//     (`value.what_works_tools_approved`), and agreeing with one is not.
//
// Weekly Performance's Value section reads this same list (owner directive, 2026-09-21), so it no
// longer carries either of them; its Adoption rows are where turning up is counted.
//
// PeerProgramming posting stays, at a weight of 1, for the reason the owner gave: a cohort session
// is a learning and collaboration setting like SkillUp, and somebody there to extract is exposed by
// it rather than hidden by it.
//
// The eligibility engine counts these events per member; this file only names them and assigns
// default weights.
//
// Default weights are inversely related to each event's expected base rate: a rare, large action
// (hosting a LightHouse stay) is worth many small, frequent ones (a Chyme tip). The owner tunes
// them without a redeploy via contributor_access_config.weights (per-key JSONB override; a missing
// key falls back to the default here).
//
// Pure constants only — no database imports, so the admin shell can import the key list.

export type ContributorValueEventKey =
  | 'value.foundation_calls_answered'
  | 'value.socket_relay_requests_fulfilled'
  | 'value.trust_transport_trips_completed'
  | 'value.lighthouse_stays_completed'
  | 'value.chyme_tips_sent'
  | 'value.service_credits_peer_sends'
  | 'value.contributions_confirmed_usd'
  | 'value.skills_hunt_nominations_accepted'
  | 'value.what_works_tools_approved'
  | 'value.skill_up_completions'
  | 'value.skill_up_trainer_payouts'
  | 'value.recurring_ties_confirmed'
  | 'value.peer_programming_active_posters';

// Which plugin each event belongs to — used for the distinct-plugins gate.
export const EVENT_SOURCE_PLUGIN: Record<ContributorValueEventKey, string> = {
  'value.foundation_calls_answered': 'foundation',
  'value.socket_relay_requests_fulfilled': 'socket-relay',
  'value.trust_transport_trips_completed': 'trust-transport',
  'value.lighthouse_stays_completed': 'lighthouse',
  'value.chyme_tips_sent': 'chyme',
  'value.service_credits_peer_sends': 'service-credits',
  'value.contributions_confirmed_usd': 'contributions',
  'value.skills_hunt_nominations_accepted': 'skills-hunt',
  'value.what_works_tools_approved': 'what-works',
  'value.skill_up_completions': 'skill-up',
  'value.skill_up_trainer_payouts': 'skill-up',
  'value.recurring_ties_confirmed': 'recurring-activity',
  'value.peer_programming_active_posters': 'peer-programming',
};

export const CONTRIBUTOR_VALUE_EVENT_KEYS = Object.keys(
  EVENT_SOURCE_PLUGIN,
) as ContributorValueEventKey[];

// Plain labels for the admin config editor.
export const EVENT_LABEL: Record<ContributorValueEventKey, string> = {
  'value.foundation_calls_answered': 'Foundation answered charged call',
  'value.socket_relay_requests_fulfilled': 'SocketRelay request closed successful',
  'value.trust_transport_trips_completed': 'TrustTransport trip completed',
  'value.lighthouse_stays_completed': 'LightHouse stay completed',
  'value.chyme_tips_sent': 'Chyme peer tip sent',
  'value.service_credits_peer_sends': 'ServiceCredits direct peer send',
  'value.contributions_confirmed_usd': 'Contributions confirmed (per USD)',
  'value.skills_hunt_nominations_accepted': 'SkillsHunt nomination accepted',
  'value.what_works_tools_approved': 'WhatWorks tool approved',
  'value.skill_up_completions': 'SkillUp enrollment completed',
  'value.skill_up_trainer_payouts': 'SkillUp trainer payout',
  'value.recurring_ties_confirmed': 'Recurring Activity tie confirmed',
  'value.peer_programming_active_posters': 'PeerProgramming week posted in',
};

// Contributions is a USD SUM, not a row count, so its weight is per dollar: 0.1 per USD = 1 point
// per 10 USD confirmed.
export const DEFAULT_WEIGHTS: Record<ContributorValueEventKey, number> = {
  'value.lighthouse_stays_completed': 25,
  'value.skill_up_completions': 10,
  'value.skill_up_trainer_payouts': 10,
  'value.foundation_calls_answered': 8,
  'value.socket_relay_requests_fulfilled': 8,
  'value.skills_hunt_nominations_accepted': 6,
  'value.what_works_tools_approved': 6,
  'value.trust_transport_trips_completed': 5,
  'value.recurring_ties_confirmed': 4,
  'value.peer_programming_active_posters': 1,
  'value.chyme_tips_sent': 1,
  'value.service_credits_peer_sends': 1,
  'value.contributions_confirmed_usd': 0.1,
};

// Effective weight for one event key: the config override when present and a finite number,
// otherwise the default.
export function effectiveWeight(
  key: ContributorValueEventKey,
  overrides: Record<string, unknown>,
): number {
  const raw = overrides[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_WEIGHTS[key];
}
