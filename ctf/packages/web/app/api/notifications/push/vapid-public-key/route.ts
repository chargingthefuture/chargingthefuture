import { NextResponse } from 'next/server';
import { requireNotificationsAccess } from '../../_lib';
import { getWebPushPublicKey } from 'lib/notifications/push';

// The public VAPID key the browser needs to create a Web Push subscription. Not secret. Empty string
// when push is not configured, so the client can show "device alerts unavailable" instead of failing.
export async function GET() {
  const gate = await requireNotificationsAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  return NextResponse.json({ ok: true, publicKey: getWebPushPublicKey() }, { status: 200 });
}
