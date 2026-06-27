import { NextResponse } from 'next/server';
import { requireGentlePulseReadAccess } from 'lib/gentle-pulse/_lib';
import { listLibraryItems } from 'lib/gentle-pulse/repository';

export async function GET() {
  const gate = await requireGentlePulseReadAccess();
  if ('response' in gate) {
    return gate.response;
  }

  const items = await listLibraryItems();
  return NextResponse.json({ ok: true, items }, { status: 200 });
}
