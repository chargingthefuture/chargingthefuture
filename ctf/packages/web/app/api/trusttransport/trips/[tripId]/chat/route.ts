import { NextResponse } from 'next/server';
import { createTrustTransportTripChannel } from 'lib/trusttransport/stream';
import { getSessionFromRequest } from 'lib/auth/session';
import { authorizeUserForTrip } from 'lib/trusttransport/auth';

export async function POST(request: Request, { params }: { params: { tripId: string } }) {
  const { tripId } = params;
  if (!tripId) {
    return NextResponse.json({ ok: false, message: 'Missing tripId' }, { status: 400 });
  }
  const session = await getSessionFromRequest(request);
  if (!session || !session.user) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }
  const authorized = await authorizeUserForTrip(tripId, session.user.id);
  if (!authorized) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
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
