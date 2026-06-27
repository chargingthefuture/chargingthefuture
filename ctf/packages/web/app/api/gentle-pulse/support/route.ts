import { NextResponse } from 'next/server';
import { requireGentlePulseReadAccess } from 'lib/gentle-pulse/_lib';

export async function GET() {
  const gate = await requireGentlePulseReadAccess();
  if ('response' in gate) {
    return gate.response;
  }

  return NextResponse.json({ ok: true, supportRoute: '/support', note: 'GentlePulse delegates support to app-level support ownership.' }, { status: 200 });
}
