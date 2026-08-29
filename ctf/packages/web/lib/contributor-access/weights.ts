// Contributor Access — value-event keys and default weights.
//
// The fifteen `value.*` event keys mirror lib/weekly-performance/live-metrics.ts exactly (the
// owner-locked decision record ctf/docs/developer/PLUGIN_VALUE_METRICS.md). The eligibility engine
// counts the SAME events per member; this file only names them and assigns default weights.
//
// Default weights are inversely related to each event's expected base rate: a rare, large action
// (hosting a Lighthouse stay) is worth many small, frequent ones (a Chyme tip). The owner tunes
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
  | 'value.what_works_endorsements_given'
  | 'value.skill_up_completions'
  | 'value.skill_up_trainer_payouts'
  | 'value.recurring_ties_confirmed'
  | 'value.peer_programming_active_posters'
  | 'value.beacon_broadcast_engagement';

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
  'value.what_works_endorsements_given': 'what-works',
  'value.skill_up_completions': 'skill-up',
  'value.skill_up_trainer_payouts': 'skill-up',
  'value.recurring_ties_confirmed': 'recurring-activity',
  'value.peer_programming_active_posters': 'peer-programming',
  'value.beacon_broadcast_engagement': 'beacon',
};

export const CONTRIBUTOR_VALUE_EVENT_KEYS = Object.keys(
  EVENT_SOURCE_PLUGIN,
) as ContributorValueEventKey[];

// Plain labels for the admin config editor.
export const EVENT_LABEL: Record<ContributorValueEventKey, string> = {
  'value.foundation_calls_answered': 'Foundation answered charged call',
  'value.socket_relay_requests_fulfilled': 'SocketRelay request closed successful',
  'value.trust_transport_trips_completed': 'TrustTransport trip completed',
  'value.lighthouse_stays_completed': 'Lighthouse stay completed',
  'value.chyme_tips_sent': 'Chyme peer tip sent',
  'value.service_credits_peer_sends': 'ServiceCredits direct peer send',
  'value.contributions_confirmed_usd': 'Contributions confirmed (per USD)',
  'value.skills_hunt_nominations_accepted': 'SkillsHunt nomination accepted',
  'value.what_works_tools_approved': 'WhatWorks tool approved',
  'value.what_works_endorsements_given': 'WhatWorks endorsement given',
  'value.skill_up_completions': 'SkillUp enrollment completed',
  'value.skill_up_trainer_payouts': 'SkillUp trainer payout',
  'value.recurring_ties_confirmed': 'Recurring Activity tie confirmed',
  'value.peer_programming_active_posters': 'PeerProgramming week posted in',
  'value.beacon_broadcast_engagement': 'Beacon broadcast engaged with',
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
  'value.what_works_endorsements_given': 2,
  'value.peer_programming_active_posters': 2,
  'value.beacon_broadcast_engagement': 1,
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
