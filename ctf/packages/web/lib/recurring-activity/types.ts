// Recurring Activity plugin types (issue #885).
//
// A recurring activity is a member's self-declared, counterparty-confirmed ONGOING relationship with
// one other member. It is deliberately NOT a ledger and NOT a payment record: no value moves, fiat
// carries no amount, and only ServiceCredits (an internal utility token) carries a declared value.

// Fixed sector dropdown — this doubles as the "brief description" so there is no free-text field a
// member could over-disclose in. Keep in sync with the schema CHECK on recurring_activities.sector.
export type RecurringActivitySector = 'housing' | 'service' | 'favor' | 'general';
export const RECURRING_ACTIVITY_SECTORS: readonly RecurringActivitySector[] = [
  'housing',
  'service',
  'favor',
  'general',
];

export type RecurringActivityCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export const RECURRING_ACTIVITY_CADENCES: readonly RecurringActivityCadence[] = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
];

// pending → counterparty has not yet confirmed (counts toward nothing).
// active  → confirmed by the counterparty (the only state that feeds Trust or GDP).
// ended   → either party ended it (no longer ongoing).
// declined→ the counterparty declined it.
export type RecurringActivityStatus = 'pending' | 'active' | 'ended' | 'declined';

export type RecurringActivityVisibility = 'private' | 'restricted' | 'public';
export const RECURRING_ACTIVITY_VISIBILITY_VALUES: readonly RecurringActivityVisibility[] = [
  'private',
  'restricted',
  'public',
];

export interface RecurringActivity {
  id: string;
  ownerUserId: string;
  counterpartyUserId: string;
  sector: RecurringActivitySector;
  currencyCode: string;
  cadence: RecurringActivityCadence;
  // Declared recurring ServiceCredits value; only ever set for SC lines. NULL for fiat lines, which
  // never carry an amount by design. Never an executed transfer — a declared figure only.
  scValue: number | null;
  status: RecurringActivityStatus;
  visibility: RecurringActivityVisibility;
  confirmedAt: string | null;
  endedAt: string | null;
  endedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  // The party the reading member is NOT — filled in per-reader by the API so the client can show
  // "with <the other member>" without the reader having to work out which side they are on.
  role?: 'owner' | 'counterparty';
}

export interface CreateRecurringActivityInput {
  ownerUserId: string;
  counterpartyUserId: string;
  sector: RecurringActivitySector;
  currencyCode: string;
  cadence: RecurringActivityCadence;
  scValue?: number | null;
  visibility?: RecurringActivityVisibility;
}
