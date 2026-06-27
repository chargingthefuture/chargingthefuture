import { NextResponse } from 'next/server';
import { requireGentlePulseReadAccess } from 'lib/gentle-pulse/_lib';
import { getLibraryItemById } from 'lib/gentle-pulse/repository';

type ItemParams = {
  params: Promise<{ itemId: string }>;
};

export async function GET(_request: Request, context: ItemParams) {
  const gate = await requireGentlePulseReadAccess();
  if ('response' in gate) {
    return gate.response;
  }

  const { itemId } = await context.params;
  const item = await getLibraryItemById(itemId);
  if (!item) {
    return NextResponse.json({ ok: false, code: 'gentle_pulse_item_not_found', message: 'Library item not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item }, { status: 200 });
}
