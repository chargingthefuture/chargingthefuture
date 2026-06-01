import { NextResponse } from 'next/server';
import { requireChymeAccess } from '../_lib';
import { sendServiceCredits } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';

export async function POST(request: Request) {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: { toUserId: string; amount: number; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.toUserId || typeof body.amount !== 'number' || body.amount <= 0) {
    return NextResponse.json({ ok: false, message: 'Invalid payload.' }, { status: 400 });
  }

  try {
    const tx = await sendServiceCredits(gate.identity.userId, body.toUserId, body.amount, body.message);
    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    reportError(error, {
      area: 'chyme',
      op: 'send_service_credits',
      extra: { userId: gate.identity.userId, toUserId: body.toUserId },
    });
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 500 });
  }
}
