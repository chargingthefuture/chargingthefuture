import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { insertServiceCreditsAudit, mintGrant } from 'lib/shared/credits-interface';
import { reportError } from 'lib/observability/report';
import { rebuildLeaderboard } from './repository';

// End-of-round awards (owner decision, 2026-10-01). A round is points only while it runs. When it
// closes, every scout whose score reached the round's points bar shares the round's ServiceCredits
// pool in proportion to their points. An admin reviews the list and presses Send; nothing moves
// before that, and a round is sent once.
//
// The split is written to skills_hunt_round_awards before any credits move, so it is fixed at the
// first Send. If the ledger refuses one scout's send (a mint budget, an outage), the others still
// go out, and pressing Send again sends only the rows still unsent; the ledger idempotency key
// makes a repeat of the same row a no-op.

// System actor on the ledger grant, as for the Unlock reward. The admin who pressed Send is
// recorded separately on the row and in the ServiceCredits audit trail.
const SKILLS_HUNT_INCENTIVE_ACTOR_ID = 'skills-hunt-incentive-system';

export type SkillsHuntAwardStanding = { userId: string; username: string | null; score: number };
export type SkillsHuntAwardShare = SkillsHuntAwardStanding & { amount: number };

export type SkillsHuntAwardLine = SkillsHuntAwardShare & { sentAtIso: string | null };

export type SkillsHuntRoundAwardPlan = {
  roundId: string;
  roundName: string;
  roundStatus: string;
  pointsBar: number | null;
  poolCredits: number;
  // Who gets what. Once a Send has started this is the stored split, not a fresh calculation.
  lines: SkillsHuntAwardLine[];
  // Credits in the plan, and the part of the pool left over because shares are rounded down to full credits.
  plannedCredits: number;
  remainder: number;
  sentAtIso: string | null;
  // Plain-language reason Send is not available yet, or null when it is.
  notReadyReason: string | null;
};

// Shares are full credits, rounded down, so the total never exceeds the pool. What rounding leaves
// over stays unsent and is shown as the remainder. A scout whose share rounds to 0 is left out.
export function splitAwardPool(
  standings: SkillsHuntAwardStanding[],
  pointsBar: number,
  poolCredits: number,
): SkillsHuntAwardShare[] {
  const eligible = standings.filter((s) => s.score >= pointsBar && s.score > 0);
  const totalPoints = eligible.reduce((sum, s) => sum + s.score, 0);
  if (totalPoints === 0 || poolCredits <= 0) return [];
  return eligible
    .map((s) => ({ ...s, amount: Math.floor((poolCredits * s.score) / totalPoints) }))
    .filter((s) => s.amount > 0);
}

type RoundAwardRow = {
  id: string;
  name: string;
  status: string;
  award_pool_credits: number | null;
  award_points_bar: number | null;
  awards_sent_at: Date | null;
};

type StoredAwardRow = {
  user_id: string;
  username_snapshot: string | null;
  score: number;
  amount: number;
  sent_at: Date | null;
};

async function readRound(client: PoolClient, roundId: string): Promise<RoundAwardRow | null> {
  const result = await client.query<RoundAwardRow>(
    `SELECT id, name, status, award_pool_credits, award_points_bar, awards_sent_at
     FROM skills_hunt_rounds WHERE id = $1::uuid`,
    [roundId],
  );
  return result.rows[0] ?? null;
}

async function readStoredAwards(client: PoolClient, roundId: string): Promise<StoredAwardRow[]> {
  const result = await client.query<StoredAwardRow>(
    `SELECT user_id, username_snapshot, score, amount, sent_at
     FROM skills_hunt_round_awards WHERE round_id = $1::uuid
     ORDER BY score DESC, user_id ASC`,
    [roundId],
  );
  return result.rows;
}

// Final standings from the round's leaderboard, rebuilt first so late reviews count.
async function readStandings(client: PoolClient, roundId: string): Promise<SkillsHuntAwardStanding[]> {
  await rebuildLeaderboard(client, roundId);
  const result = await client.query<{ user_id: string; username_snapshot: string | null; score: number }>(
    `SELECT user_id, username_snapshot, score
     FROM skills_hunt_leaderboard
     WHERE round_id = $1::uuid AND mode = 'individual' AND user_id IS NOT NULL
     ORDER BY rank ASC`,
    [roundId],
  );
  return result.rows.map((r) => ({ userId: r.user_id, username: r.username_snapshot, score: Number(r.score) }));
}

function notReadyReason(round: RoundAwardRow): string | null {
  if (round.status !== 'closed') return 'Close the round first. Awards are worked out from the final points.';
  if (round.award_points_bar === null) return 'Set the points a scout needs for an award on this round.';
  if (!round.award_pool_credits) return 'Set the ServiceCredits pool for this round.';
  return null;
}

function toLines(rows: StoredAwardRow[]): SkillsHuntAwardLine[] {
  return rows.map((r) => ({
    userId: r.user_id,
    username: r.username_snapshot,
    score: Number(r.score),
    amount: Number(r.amount),
    sentAtIso: r.sent_at ? r.sent_at.toISOString() : null,
  }));
}

async function buildPlan(client: PoolClient, round: RoundAwardRow): Promise<SkillsHuntRoundAwardPlan> {
  const pool = Number(round.award_pool_credits ?? 0);
  const bar = round.award_points_bar === null ? null : Number(round.award_points_bar);
  const stored = await readStoredAwards(client, round.id);
  const lines = stored.length > 0
    ? toLines(stored)
    : bar === null ? [] : splitAwardPool(await readStandings(client, round.id), bar, pool).map((s) => ({ ...s, sentAtIso: null }));
  const plannedCredits = lines.reduce((sum, l) => sum + l.amount, 0);
  const reason = notReadyReason(round) ?? (lines.length === 0 ? 'No scout reached the points bar.' : null);
  return {
    roundId: round.id,
    roundName: round.name,
    roundStatus: round.status,
    pointsBar: bar,
    poolCredits: pool,
    lines,
    plannedCredits,
    remainder: Math.max(0, pool - plannedCredits),
    sentAtIso: round.awards_sent_at ? round.awards_sent_at.toISOString() : null,
    notReadyReason: reason,
  };
}

export async function getRoundAwardPlan(roundId: string): Promise<SkillsHuntRoundAwardPlan | null> {
  return withDbTransaction(async (client) => {
    const round = await readRound(client, roundId);
    return round ? buildPlan(client, round) : null;
  });
}

export class SkillsHuntAwardNotReadyError extends Error {
  constructor(readonly reason: string) {
    super('skills_hunt_round_award_not_ready');
  }
}

// Fix the split: write one row per awarded scout, unless a previous Send already did.
async function lockInSplit(actorId: string, roundId: string): Promise<SkillsHuntRoundAwardPlan | null> {
  return withDbTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sh-round-award:${roundId}`]);
    const round = await readRound(client, roundId);
    if (!round) return null;
    const plan = await buildPlan(client, round);
    if (plan.notReadyReason) throw new SkillsHuntAwardNotReadyError(plan.notReadyReason);
    for (const line of plan.lines) {
      await client.query(
        `INSERT INTO skills_hunt_round_awards (round_id, user_id, username_snapshot, score, amount, created_by_user_id)
         VALUES ($1::uuid, $2, $3, $4, $5, $6)
         ON CONFLICT (round_id, user_id) DO NOTHING`,
        [roundId, line.userId, line.username, line.score, line.amount, actorId],
      );
    }
    return plan;
  });
}

async function sendOne(actorId: string, roundId: string, line: SkillsHuntAwardLine): Promise<boolean> {
  const idempotencyKey = `skills-hunt-round-award-${roundId}-${line.userId}`;
  try {
    const grant = await mintGrant({
      actorId: SKILLS_HUNT_INCENTIVE_ACTOR_ID,
      targetUserId: line.userId,
      amount: line.amount,
      grantReason: 'skills_hunt_round_award',
      governanceTicketId: `skills-hunt:round-award:${roundId}:${line.userId}`,
      idempotencyKey,
    });
    await queryDb(
      `UPDATE skills_hunt_round_awards SET sent_at = NOW(), governance_event_id = $3
       WHERE round_id = $1::uuid AND user_id = $2 AND sent_at IS NULL`,
      [roundId, line.userId, grant.governanceEventId],
    );
    await insertServiceCreditsAudit({
      actorId,
      command: 'service-credits.governance.mint.grant.skills-hunt',
      policyStatus: 'allow',
      reason: 'skills_hunt_round_award',
      targetType: 'governance_event',
      targetId: grant.governanceEventId,
      metadata: { roundId, targetUserId: line.userId, amount: line.amount, score: line.score, idempotencyKey },
    });
    return true;
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'round_award_send', extra: { roundId, userId: line.userId } });
    return false;
  }
}

export type SkillsHuntAwardSendResult = { sentNow: number; failed: number; plan: SkillsHuntRoundAwardPlan };

export async function sendRoundAwards(actorId: string, roundId: string): Promise<SkillsHuntAwardSendResult | null> {
  const locked = await lockInSplit(actorId, roundId);
  if (!locked) return null;
  const pending = (await getRoundAwardPlan(roundId))?.lines.filter((l) => l.sentAtIso === null) ?? [];
  let sentNow = 0;
  let failed = 0;
  for (const line of pending) {
    if (await sendOne(actorId, roundId, line)) sentNow += 1;
    else failed += 1;
  }
  if (failed === 0) {
    await queryDb(
      'UPDATE skills_hunt_rounds SET awards_sent_at = COALESCE(awards_sent_at, NOW()) WHERE id = $1::uuid',
      [roundId],
    );
  }
  const plan = await getRoundAwardPlan(roundId);
  return plan ? { sentNow, failed, plan } : null;
}
