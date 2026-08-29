import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listTrainers } from 'lib/skill-up/repository';
import { skillUpErrorResponse, requireSkillUpReadAccess } from 'lib/skill-up/_lib';
import { reportError } from 'lib/observability/report';

const querySchema = z.object({
  track: z.string().optional(),
});

export async function GET(request: Request) {
  const gate = await requireSkillUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    track: url.searchParams.get('track') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_payload', message: 'Invalid query filters.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const trainers = await listTrainers({ track: parsed.data.track });
    return NextResponse.json({ ok: true, trainers });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'trainers' });
    return skillUpErrorResponse(error, 'Trainers directory unavailable.');
  }
}
