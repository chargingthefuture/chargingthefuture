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
  // Which app the member declared this from, when they used that app's inline "mark as recurring"
  // control. NULL when they used the Recurring Activity plugin's own form. See
  // RECURRING_ACTIVITY_ORIGIN_PLUGINS below.
  originPlugin: string | null;
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
  originPlugin?: string | null;
}

// The apps that may declare a recurring activity inline, so a member never has to leave what they are
// doing to record one. Anything else is rejected at write time, which keeps `origin_plugin` a small
// known set rather than free text a client could put anything in.
export const RECURRING_ACTIVITY_ORIGIN_PLUGINS: readonly string[] = [
  'lighthouse',
  'foundation',
  'socket-relay',
  'trust-transport',
  'service-credits',
];

// Apps that already record EVERY exchange as it happens: a Foundation call is metered per minute-block,
// a TrustTransport trip is settled per trip, a SocketRelay favor is closed one at a time. GDP already
// recognizes each of those occurrences, so a declared ServiceCredits value from one of these would count
// the same value a second time. A declaration from one of these apps is therefore recognized as a
// RELATIONSHIP (one point, the way a fiat line is counted) and never again as value. LightHouse is not
// on this list: it records the arrangement once and never sees the months that follow, so its declared
// value is the only record there is.
export const PER_OCCURRENCE_ORIGIN_PLUGINS: readonly string[] = [
  'foundation',
  'socket-relay',
  'trust-transport',
  // Every completed send is already recognized from the transfers table, so a standing arrangement
  // declared beside one counts as a relationship, never again as value.
  'service-credits',
];
