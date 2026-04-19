import { NextResponse } from 'next/server';
import { createTrustTransportTripChannel } from 'lib/trusttransport/stream';

export async function POST(request: Request, { params }: { params: { tripId: string } }) {
  const { tripId } = params;
  if (!tripId) {
    return NextResponse.json({ ok: false, message: 'Missing tripId' }, { status: 400 });
  }
  try {
    const credentials = await createTrustTransportTripChannel(tripId);
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...credentials });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message || 'Error creating chat channel' }, { status: 500 });
  }
}
