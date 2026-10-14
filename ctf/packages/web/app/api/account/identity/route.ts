import { NextResponse } from 'next/server';
import { requireAccountAccess } from '../_lib';

// Who the signed-in caller is, as the server sees them: the Clerk user id, the username and whether
// they are an admin. The Android app reads it after sign-in, because its sign-in token carries neither
// the username nor the role, so without this an admin gets no Admin pill and every handle shows a short
// id. Auth posture matches the other /api/account routes: any signed-in identity may read its own.

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireAccountAccess();
  if (!access.allowed) {
    return access.response;
  }

  const { userId, username, isAdmin } = access.auth;
  return NextResponse.json({ ok: true, userId, username, isAdmin });
}
