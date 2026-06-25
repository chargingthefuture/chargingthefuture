import { NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { getWebPushPublicKey } from 'lib/notifications/push';

// Return the public VAPID key the browser needs to create a Web Push subscription (issue #808 task 5). The
// public key is NOT secret and is safe to expose. When push is not configured (the owner has not set the
// VAPID env vars), this returns enabled:false with an empty key so the client can show a clear
// "alerts unavailable" state rather than failing. Read-only and auth-gated.
export async function GET() {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const publicKey = getWebPushPublicKey();
  return NextResponse.json({ ok: true, enabled: publicKey.length > 0, publicKey }, { status: 200 });
}
