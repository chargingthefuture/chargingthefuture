import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listTrainers } from 'lib/level-up/repository';
import { levelUpErrorResponse, requireLevelUpReadAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';

const querySchema = z.object({
  track: z.string().optional(),
});

export async function GET(request: Request) {
  const gate = await requireLevelUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    track: url.searchParams.get('track') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_payload', message: 'Invalid query filters.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const trainers = await listTrainers({ track: parsed.data.track });
    return NextResponse.json({ ok: true, trainers });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'trainers' });
    return levelUpErrorResponse(error, 'Trainers directory unavailable.');
  }
}
