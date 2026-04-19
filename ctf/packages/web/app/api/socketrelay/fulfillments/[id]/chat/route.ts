import { NextResponse } from 'next/server';
import { createSocketRelayChatChannel } from 'lib/socketrelay/stream';
import { requireFeedAccess } from 'lib/auth/require-feed-access';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ ok: false, message: 'Missing fulfillment id' }, { status: 400 });
  }
  // Auth check: requireFeedAccess ensures the user is authorized for this fulfillment
  const authorized = await requireFeedAccess(request, id);
  if (!authorized) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }
  try {
    const credentials = await createSocketRelayChatChannel(id);
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...credentials });
  } catch (error: unknown) {
    let message = 'Error creating chat channel';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      message = JSON.stringify(error);
    }
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
