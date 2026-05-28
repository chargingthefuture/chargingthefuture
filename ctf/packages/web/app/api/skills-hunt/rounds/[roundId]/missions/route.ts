import { NextResponse } from 'next/server';
import { requireSkillsHuntReadAccess } from '../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { listMissionsForRoundWithProgress } from 'lib/skills-hunt/missions';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';

export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { roundId } = await params;

  try {
    const items = await withDbTransaction((client) =>
      listMissionsForRoundWithProgress(client, roundId, gate.auth.userId),
    );
    return NextResponse.json({ items }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to load missions.' },
      { status: 503 },
    );
  }
}
