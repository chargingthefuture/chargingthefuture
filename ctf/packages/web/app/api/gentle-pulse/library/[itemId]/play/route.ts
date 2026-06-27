import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireGentlePulseWriteAccess } from 'lib/gentle-pulse/_lib';
import { trackPlayEvent } from 'lib/gentle-pulse/repository';

type ItemParams = {
  params: Promise<{ itemId: string }>;
};

type PlayBody = {
  anonymousClientId?: string;
  completed?: boolean;
};

export async function POST(request: Request, context: ItemParams) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireGentlePulseWriteAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: PlayBody = {};
  try {
    body = (await request.json()) as PlayBody;
  } catch {
  }

  const { itemId } = await context.params;
  await trackPlayEvent({
    userId: gate.auth.userId,
    anonymousClientId: typeof body.anonymousClientId === 'string' ? body.anonymousClientId : null,
    itemId,
    completed: Boolean(body.completed),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
