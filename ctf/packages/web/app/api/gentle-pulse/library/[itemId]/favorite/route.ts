import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireGentlePulseWriteAccess } from 'lib/gentle-pulse/_lib';
import { setFavorite } from 'lib/gentle-pulse/repository';

type ItemParams = {
  params: Promise<{ itemId: string }>;
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

  const { itemId } = await context.params;
  await setFavorite({ userId: gate.auth.userId, itemId, favorited: true });
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request, context: ItemParams) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireGentlePulseWriteAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { itemId } = await context.params;
  await setFavorite({ userId: gate.auth.userId, itemId, favorited: false });
  return NextResponse.json({ ok: true }, { status: 200 });
}
