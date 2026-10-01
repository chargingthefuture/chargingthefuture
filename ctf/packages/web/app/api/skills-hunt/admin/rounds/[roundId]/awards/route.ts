import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { insertSkillsHuntAudit } from 'lib/skills-hunt/repository';
import { getRoundAwardPlan, sendRoundAwards, SkillsHuntAwardNotReadyError } from 'lib/skills-hunt/round-awards';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

const roundNotFound = () =>
  NextResponse.json({ ok: false, code: SKILLS_HUNT_ERROR_CODE.roundNotFound, message: 'Round not found.' }, { status: 404 });

// Who would get what from the round's end-of-round award, or who got what once it was sent.
// Command skills-hunt.round.award.preview. Admin only: it lists other members' final points.
export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) return gate.response;
  const { roundId } = await params;
  try {
    const plan = await getRoundAwardPlan(roundId);
    if (!plan) return roundNotFound();
    return NextResponse.json({ ok: true, plan }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_round_awards_preview' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to work out the round's awards: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

// Send the round's awards. Command skills-hunt.round.award.send. Safe to press again: it sends
// only what is still unsent and never recalculates a split that has started going out.
export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) return gate.response;
  const { roundId } = await params;
  try {
    const result = await sendRoundAwards(gate.auth.userId, roundId);
    if (!result) return roundNotFound();
    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.round.award.send',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'round',
      targetId: roundId,
      metadata: { sentNow: result.sentNow, failed: result.failed, plannedCredits: result.plan.plannedCredits },
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    if (error instanceof SkillsHuntAwardNotReadyError) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.roundAwardNotReady, message: error.reason },
        { status: 409 },
      );
    }
    reportError(error, { area: 'skills-hunt', op: 'admin_round_awards_send' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to send the round's awards: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
