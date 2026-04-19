import { NextResponse } from 'next/server';
import { createLighthouseMatchChannel } from 'lib/lighthouse/stream';

export async function POST(request: Request, { params }: { params: { matchId: string } }) {
  const { matchId } = params;
  if (!matchId) {
    return NextResponse.json({ ok: false, message: 'Missing matchId' }, { status: 400 });
  }
  try {
    const credentials = await createLighthouseMatchChannel(matchId);
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...credentials });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message || 'Error creating chat channel' }, { status: 500 });
  }
}
