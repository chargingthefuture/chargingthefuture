import { NextResponse } from 'next/server';
import { listModes } from 'lib/trust-transport/repository';

export async function GET() {
  const modes = await listModes();
  return NextResponse.json({ ok: true, modes }, { status: 200 });
}
