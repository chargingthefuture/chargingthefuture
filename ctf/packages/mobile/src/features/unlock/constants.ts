// Mirror of packages/web/lib/unlock/constants.ts — how long a ServiceCredits verification reward may
// take to arrive after an Unlock approval (the background reconciliation job issues a missed reward
// within this window). Keep the two in sync.
export const UNLOCK_REWARD_SLA_HOURS = 24;
