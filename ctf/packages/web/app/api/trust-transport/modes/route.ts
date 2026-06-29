import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess } from 'lib/trust-transport/_lib';
import { listModes } from 'lib/trust-transport/repository';

export async function GET() {
  // Gate the mode list behind the same read access as every other read route in this plugin. The
  // access policy requires at minimum the member role for all trust-transport commands, so an
  // unauthenticated caller must not be able to enumerate the modes.
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const modes = await listModes();
  return NextResponse.json({ ok: true, modes }, { status: 200 });
}
