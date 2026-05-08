import { NextRequest, NextResponse } from 'next/server';
import { getMyCohort } from 'lib/peer-programming/repository';
import { requirePeerProgrammingAuth } from 'lib/peer-programming/auth';
import type { AuthProvider } from '@ctf/shared';

export async function GET(req: NextRequest) {
  // Example: extract provider/token from headers
  const provider = (req.headers.get('x-auth-provider') as AuthProvider) || 'clerk';
  const authHeader = req.headers.get('authorization');
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const authResult = await requirePeerProgrammingAuth({ provider, token });
  if (!authResult.isAuthenticated) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const cohorts = await getMyCohort(authResult.userId ?? '');
    return NextResponse.json(cohorts, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load cohorts' }, { status: 500 });
  }
}
