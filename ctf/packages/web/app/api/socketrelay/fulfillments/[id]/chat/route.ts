import { NextResponse } from 'next/server';
import { createSocketRelayChatChannel } from 'lib/socketrelay/stream';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ ok: false, message: 'Missing fulfillment id' }, { status: 400 });
  }
  try {
    const credentials = await createSocketRelayChatChannel(id);
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...credentials });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message || 'Error creating chat channel' }, { status: 500 });
  }
}
