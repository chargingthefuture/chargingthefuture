// How long a ServiceCredits verification reward may take to arrive after an Unlock approval. The reward
// is minted on approval; if that mint fails, a background reconciliation job issues it within this window.
// Used in member- and admin-facing copy so a definite arrival window can be stated.
export const UNLOCK_REWARD_SLA_HOURS = 24;
