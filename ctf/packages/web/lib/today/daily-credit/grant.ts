import { insertServiceCreditsAudit, mintGrant } from 'lib/shared/credits-interface';
import { isUserUnlocked } from 'lib/shared/unlock-interface';
import { reportError } from 'lib/observability/report';
import {
  claimHeldDailyCredit,
  listHeldDailyCredits,
  markDailyCreditGranted,
  markDailyCreditHeld,
  stampDailyCreditHelper,
} from './repository';

// The credit on the day's credit card (owner decisions, 2026-11-11). ServiceCredits are an internal
// credits unit: not money, never redeemable. The credit is newly created through the governance grant
// path, the way Contributions and Skill Up credits are, and never taken from the asker.
//
// It goes to the member who helped once the asker confirms it was done: a PeerProgramming task result
// kept, a SocketRelay fulfillment resolved as successful, or the ask closed as done from Today.
// "Done" is enough; whether it helped is not asked. Once per card: the helper is stamped on the
// card's earliest day before anything is created, and the grant carries the key card + day + helper.
//
// A helper not yet approved in Unlock is held, the way Contributions holds thank-you credits, and
// granted when Unlock approves them (lib/shared/unlock-approval-interface.ts).

export const DAILY_CREDIT_AMOUNT = 1;

// One fixed actor for every grant, so the grant's idempotency key means the same thing whether the
// grant runs at the confirm or at the helper's approval.
export const DAILY_CREDIT_ACTOR_ID = 'today-daily-credit';

export type DailyCreditOutcome =
  | { status: 'granted'; day: string }
  | { status: 'held'; day: string }
  | { status: 'not_credit_card' }
  | { status: 'failed'; day: string; reason: string };

async function mintFor(day: string, cardId: string, helperUserId: string, askerUserId: string): Promise<string | null> {
  const grant = await mintGrant({
    actorId: DAILY_CREDIT_ACTOR_ID,
    targetUserId: helperUserId,
    amount: DAILY_CREDIT_AMOUNT,
    grantReason: 'today_daily_credit_card_done',
    governanceTicketId: `today:daily-credit:${day}`,
    idempotencyKey: `today-daily-credit:${cardId}:${day}:${helperUserId}`,
  });
  await markDailyCreditGranted(day, grant.governanceEventId);
  await insertServiceCreditsAudit({
    actorId: askerUserId,
    command: 'service-credits.today.daily-credit.grant',
    policyStatus: 'allow',
    reason: 'asker_confirmed_done',
    targetType: 'today_daily_credit_card',
    targetId: day,
    metadata: { cardId, helperUserId, amount: DAILY_CREDIT_AMOUNT, governanceEventId: grant.governanceEventId },
  });
  return grant.governanceEventId;
}

async function grantStamped(day: string, cardId: string, helperUserId: string, askerUserId: string): Promise<DailyCreditOutcome> {
  try {
    await mintFor(day, cardId, helperUserId, askerUserId);
    return { status: 'granted', day };
  } catch (error) {
    // Back to held, so the helper's next approval run tries again; the key keeps that from creating twice.
    await markDailyCreditHeld(day).catch((markError) => reportError(markError, { area: 'today', op: 'daily_credit_mark_held' }));
    return { status: 'failed', day, reason: error instanceof Error ? error.message : 'mint_failed' };
  }
}

async function recordHeld(day: string, cardId: string, helperUserId: string, askerUserId: string): Promise<void> {
  await insertServiceCreditsAudit({
    actorId: askerUserId,
    command: 'service-credits.today.daily-credit.grant',
    policyStatus: 'allow',
    reason: 'held_until_unlock_approval',
    targetType: 'today_daily_credit_card',
    targetId: day,
    metadata: { cardId, helperUserId, amount: DAILY_CREDIT_AMOUNT },
  });
}

/** The asker confirmed the ask was done and names who helped. Safe to call for any card. */
export async function grantDailyCredit(input: { cardId: string; askerUserId: string; helperUserId: string | null }): Promise<DailyCreditOutcome> {
  const { cardId, askerUserId, helperUserId } = input;
  if (!helperUserId || helperUserId === askerUserId) return { status: 'not_credit_card' };
  const unlocked = await isUserUnlocked(helperUserId);
  const day = await stampDailyCreditHelper({ cardId, askerUserId, helperUserId, status: unlocked ? 'granted' : 'held' });
  if (!day) return { status: 'not_credit_card' };
  if (!unlocked) {
    await recordHeld(day, cardId, helperUserId, askerUserId);
    return { status: 'held', day };
  }
  return grantStamped(day, cardId, helperUserId, askerUserId);
}

/**
 * Best-effort wrapper for the confirm routes: the confirm itself already happened and must not fail
 * because the credit did. A failure is reported and the credit stays held for a later approval run.
 */
export async function grantDailyCreditQuietly(input: { cardId: string; askerUserId: string; helperUserId: string | null }): Promise<void> {
  try {
    const outcome = await grantDailyCredit(input);
    if (outcome.status === 'failed') {
      reportError(new Error(`daily credit grant failed: ${outcome.reason}`), { area: 'today', op: 'daily_credit_grant', extra: { day: outcome.day } });
    }
  } catch (error) {
    reportError(error, { area: 'today', op: 'daily_credit_grant' });
  }
}

/** Unlock approved this member: grant every daily credit held for them. Returns how many were granted. */
export async function grantHeldDailyCredits(userId: string): Promise<number> {
  let granted = 0;
  for (const held of await listHeldDailyCredits(userId)) {
    if (!(await claimHeldDailyCredit(held.day, userId))) continue;
    const outcome = await grantStamped(held.day, held.cardId, userId, held.authorUserId);
    if (outcome.status === 'granted') granted += 1;
    else if (outcome.status === 'failed') {
      reportError(new Error(`daily credit grant failed: ${outcome.reason}`), { area: 'today', op: 'daily_credit_grant_on_approval', extra: { day: held.day } });
    }
  }
  return granted;
}
