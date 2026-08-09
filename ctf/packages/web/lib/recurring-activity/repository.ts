import { queryDb } from 'lib/db/postgres';
import { getCurrency } from 'lib/currency/repository';
import type { Currency } from 'lib/currency/types';
import { SERVICE_CREDITS_CODE } from './constants';
import {
  RECURRING_ACTIVITY_ORIGIN_PLUGINS,
} from './types';
import type {
  CreateRecurringActivityInput,
  RecurringActivity,
  RecurringActivityCadence,
  RecurringActivitySector,
  RecurringActivityStatus,
  RecurringActivityVisibility,
} from './types';

interface RecurringActivityRow {
  id: string;
  owner_user_id: string;
  counterparty_user_id: string;
  sector: string;
  currency_code: string;
  cadence: string;
  sc_value: string | null;
  status: string;
  visibility: string;
  confirmed_at: Date | null;
  ended_at: Date | null;
  ended_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  origin_plugin: string | null;
}

const SELECT_COLUMNS = `id, owner_user_id, counterparty_user_id, sector, currency_code, cadence,
  sc_value::text AS sc_value, status, visibility, confirmed_at, ended_at, ended_by_user_id,
  created_at, updated_at, origin_plugin`;

function mapRow(row: RecurringActivityRow): RecurringActivity {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    counterpartyUserId: row.counterparty_user_id,
    sector: row.sector as RecurringActivitySector,
    currencyCode: row.currency_code,
    cadence: row.cadence as RecurringActivityCadence,
    scValue: row.sc_value === null ? null : Number(row.sc_value),
    status: row.status as RecurringActivityStatus,
    visibility: row.visibility as RecurringActivityVisibility,
    confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
    endedAt: row.ended_at ? row.ended_at.toISOString() : null,
    endedByUserId: row.ended_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    originPlugin: row.origin_plugin,
  };
}

export class RecurringActivityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecurringActivityValidationError';
  }
}

// All activities the member is part of (either side), newest first. Used by the hub and to surface
// pending confirmations the member needs to act on.
export async function listRecurringActivitiesForUser(userId: string): Promise<RecurringActivity[]> {
  const result = await queryDb<RecurringActivityRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM recurring_activities
      WHERE owner_user_id = $1 OR counterparty_user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map((row) => {
    const activity = mapRow(row);
    activity.role = activity.ownerUserId === userId ? 'owner' : 'counterparty';
    return activity;
  });
}

async function getActivityRow(activityId: string): Promise<RecurringActivity | null> {
  const result = await queryDb<RecurringActivityRow>(
    `SELECT ${SELECT_COLUMNS} FROM recurring_activities WHERE id = $1`,
    [activityId],
  );
  return result.rows.length ? mapRow(result.rows[0]) : null;
}

// Validate the two participants: a counterparty is required and a member cannot record an activity
// with themselves. Returns the trimmed ids used for the insert.
function resolveParticipants(input: CreateRecurringActivityInput): {
  ownerUserId: string;
  counterpartyUserId: string;
} {
  const ownerUserId = input.ownerUserId.trim();
  const counterpartyUserId = input.counterpartyUserId.trim();
  if (!counterpartyUserId) {
    throw new RecurringActivityValidationError('A counterparty is required.');
  }
  if (ownerUserId === counterpartyUserId) {
    throw new RecurringActivityValidationError('You cannot record an activity with yourself.');
  }
  return { ownerUserId, counterpartyUserId };
}

// Enforce the value firewall for the declared amount and return the value to store. ServiceCredits
// lines may carry an optional positive value; fiat (or any non-SC) lines must never carry an amount.
function resolveScValue(currency: Currency, scValue: number | null | undefined): number | null {
  const isServiceCredits = currency.isServiceCredits || currency.code === SERVICE_CREDITS_CODE;
  if (isServiceCredits) {
    // ServiceCredits is an internal utility token, so a declared value is allowed here (still not an
    // executed transfer). Optional — a member may leave it blank.
    if (scValue !== undefined && scValue !== null) {
      // Reject zero as well as negatives: a declared value of 0 is meaningless and only useful to
      // probe the firewall. The web form already guards > 0; enforce it server-side for every client.
      if (!Number.isFinite(scValue) || scValue <= 0) {
        throw new RecurringActivityValidationError('ServiceCredits value must be a positive number.');
      }
      return scValue;
    }
    return null;
  }
  if (scValue !== undefined && scValue !== null) {
    // Liability firewall: a fiat (or any non-SC) line must NEVER carry an amount. Reject rather than
    // silently drop, so a client bug can't quietly start storing recurring fiat amounts.
    throw new RecurringActivityValidationError('A fiat recurring activity cannot carry an amount.');
  }
  return null;
}

// The app the declaration came from, or null for the Recurring Activity plugin's own form. An
// unrecognized slug is rejected rather than stored: origin_plugin decides how GDP recognizes the line,
// so a client must not be able to put an arbitrary value there.
function resolveOriginPlugin(originPlugin: string | null | undefined): string | null {
  if (originPlugin === undefined || originPlugin === null || originPlugin === '') {
    return null;
  }
  if (!RECURRING_ACTIVITY_ORIGIN_PLUGINS.includes(originPlugin)) {
    throw new RecurringActivityValidationError('Unknown originPlugin.');
  }
  return originPlugin;
}

/**
 * Is this counterparty a real member? Inventory gap #3: the schema only guarded against naming
 * yourself, so a client could name any string and it would be stored. Now that the prompt appears in
 * five apps rather than one picker, the id arrives from more places and is worth checking.
 *
 * Deliberately permissive — it rejects only an id that NOTHING on the platform knows about. `users`
 * does not exist in every environment (it is not in schema.sql; see countTotalMembers), so the check
 * asks three sources and accepts a match from any: a claimed directory profile, a recorded sign-in, or
 * the accounts table where it exists. A member who has signed in even once is known, so this cannot
 * reject a legitimate arrangement while still refusing an invented id.
 */
async function counterpartyIsAMember(userId: string): Promise<boolean> {
  const result = await queryDb<{ known: boolean }>(
    `SELECT (
       EXISTS (SELECT 1 FROM directory_profiles WHERE claimed_by_user_id = $1)
       OR EXISTS (SELECT 1 FROM login_events WHERE user_id = $1)
       OR (
         to_regclass('public.users') IS NOT NULL
         AND EXISTS (SELECT 1 FROM users WHERE id = $1)
       )
     ) AS known`,
    [userId],
  );
  return result.rows[0]?.known === true;
}

// Create a pending recurring activity declared by the owner. Validates: no self-activity, a real
// active currency, and that a ServiceCredits value (if any) is present only for SC lines. Fiat lines
// never carry an amount — the value firewall is enforced here, not just in the UI.
export async function createRecurringActivity(input: CreateRecurringActivityInput): Promise<RecurringActivity> {
  const { ownerUserId, counterpartyUserId } = resolveParticipants(input);

  const currency = await getCurrency(input.currencyCode);
  if (!currency || !currency.isActive) {
    throw new RecurringActivityValidationError('Unknown or inactive currency.');
  }

  // A failed lookup must not block a real member from recording an arrangement, so an unreadable
  // check is treated as "known" — the guard exists to refuse an invented id, not to add a new way for
  // the feature to break.
  const counterpartyKnown = await counterpartyIsAMember(counterpartyUserId).catch(() => true);
  if (!counterpartyKnown) {
    throw new RecurringActivityValidationError('That member could not be found.');
  }

  const scValue = resolveScValue(currency, input.scValue);
  const visibility: RecurringActivityVisibility = input.visibility ?? 'private';
  const originPlugin = resolveOriginPlugin(input.originPlugin);

  const result = await queryDb<RecurringActivityRow>(
    `INSERT INTO recurring_activities
       (owner_user_id, counterparty_user_id, sector, currency_code, cadence, sc_value, visibility, status, origin_plugin)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
     RETURNING ${SELECT_COLUMNS}`,
    [ownerUserId, counterpartyUserId, input.sector, currency.code, input.cadence, scValue, visibility, originPlugin],
  );
  return mapRow(result.rows[0]);
}

export type RecurringActivityMutationResult =
  | { ok: true; activity: RecurringActivity }
  | { ok: false; code: 'not_found' | 'forbidden' | 'conflict'; message: string };

// Counterparty confirms a pending activity → active. Only the counterparty may confirm; the owner
// declaring it is not enough for it to count (this is the two-sided guard against inflated activity).
export async function confirmRecurringActivity(
  activityId: string,
  actorUserId: string,
): Promise<RecurringActivityMutationResult> {
  const activity = await getActivityRow(activityId);
  if (!activity) {
    return { ok: false, code: 'not_found', message: 'Activity not found.' };
  }
  if (activity.counterpartyUserId !== actorUserId) {
    return { ok: false, code: 'forbidden', message: 'Only the other member can confirm this activity.' };
  }
  if (activity.status !== 'pending') {
    return { ok: false, code: 'conflict', message: 'This activity is no longer pending.' };
  }
  const result = await queryDb<RecurringActivityRow>(
    `UPDATE recurring_activities
        SET status = 'active', confirmed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING ${SELECT_COLUMNS}`,
    [activityId],
  );
  if (!result.rows.length) {
    return { ok: false, code: 'conflict', message: 'This activity is no longer pending.' };
  }
  return { ok: true, activity: mapRow(result.rows[0]) };
}

// Counterparty declines a pending activity → declined. Only the counterparty may decline.
export async function declineRecurringActivity(
  activityId: string,
  actorUserId: string,
): Promise<RecurringActivityMutationResult> {
  const activity = await getActivityRow(activityId);
  if (!activity) {
    return { ok: false, code: 'not_found', message: 'Activity not found.' };
  }
  if (activity.counterpartyUserId !== actorUserId) {
    return { ok: false, code: 'forbidden', message: 'Only the other member can decline this activity.' };
  }
  if (activity.status !== 'pending') {
    return { ok: false, code: 'conflict', message: 'This activity is no longer pending.' };
  }
  const result = await queryDb<RecurringActivityRow>(
    `UPDATE recurring_activities
        SET status = 'declined', updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING ${SELECT_COLUMNS}`,
    [activityId],
  );
  if (!result.rows.length) {
    return { ok: false, code: 'conflict', message: 'This activity is no longer pending.' };
  }
  return { ok: true, activity: mapRow(result.rows[0]) };
}

// Either party ends an ongoing (pending or active) activity → ended, so the index reflects reality.
export async function endRecurringActivity(
  activityId: string,
  actorUserId: string,
): Promise<RecurringActivityMutationResult> {
  const activity = await getActivityRow(activityId);
  if (!activity) {
    return { ok: false, code: 'not_found', message: 'Activity not found.' };
  }
  if (activity.ownerUserId !== actorUserId && activity.counterpartyUserId !== actorUserId) {
    return { ok: false, code: 'forbidden', message: 'Only a member of this activity can end it.' };
  }
  if (activity.status !== 'pending' && activity.status !== 'active') {
    return { ok: false, code: 'conflict', message: 'This activity has already ended.' };
  }
  const result = await queryDb<RecurringActivityRow>(
    `UPDATE recurring_activities
        SET status = 'ended', ended_at = NOW(), ended_by_user_id = $2, updated_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'active')
      RETURNING ${SELECT_COLUMNS}`,
    [activityId, actorUserId],
  );
  if (!result.rows.length) {
    return { ok: false, code: 'conflict', message: 'This activity has already ended.' };
  }
  return { ok: true, activity: mapRow(result.rows[0]) };
}

// The owner controls visibility of the activity they declared (private default; only coarse aggregate
// counts ever reach public surfaces regardless of this setting).
export async function setRecurringActivityVisibility(
  activityId: string,
  actorUserId: string,
  visibility: RecurringActivityVisibility,
): Promise<RecurringActivityMutationResult> {
  const activity = await getActivityRow(activityId);
  if (!activity) {
    return { ok: false, code: 'not_found', message: 'Activity not found.' };
  }
  if (activity.ownerUserId !== actorUserId) {
    return { ok: false, code: 'forbidden', message: 'Only the member who recorded this activity can change its visibility.' };
  }
  if (activity.status === 'ended' || activity.status === 'declined') {
    // Visibility only makes sense while the activity is live (pending or active). Once it has ended or
    // was declined it is no longer surfaced, so changing where it would show is a no-op at best.
    return { ok: false, code: 'conflict', message: 'This activity is no longer ongoing, so its visibility cannot change.' };
  }
  const result = await queryDb<RecurringActivityRow>(
    `UPDATE recurring_activities
        SET visibility = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING ${SELECT_COLUMNS}`,
    [activityId, visibility],
  );
  if (!result.rows.length) {
    // The row was deleted between the ownership check and this UPDATE. Return a clean not-found rather
    // than letting mapRow throw on an undefined row (which would surface as a 503).
    return { ok: false, code: 'not_found', message: 'Activity not found.' };
  }
  return { ok: true, activity: mapRow(result.rows[0]) };
}

// Distinct OTHER members with whom the member has an ACTIVE recurring activity (either side). Distinct
// counterparties (not raw activity count) so a single repeated partner can't inflate the Trust signal
// — the same breadth-of-trust defense the ServiceCredits distinct-payers signal uses.
export async function countActiveRecurringActivityCounterparties(userId: string): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*) AS count FROM (
        SELECT counterparty_user_id AS other FROM recurring_activities
          WHERE owner_user_id = $1 AND status = 'active'
        UNION
        SELECT owner_user_id AS other FROM recurring_activities
          WHERE counterparty_user_id = $1 AND status = 'active'
      ) distinct_counterparties`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}
