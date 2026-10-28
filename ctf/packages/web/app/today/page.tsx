import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveRequestIdentity } from '../../lib/auth/request-identity';
import { getHostedSignInUrl } from '../../lib/auth/provider-env';
import { PublicToday } from '../../components/se-frame/public-today';

// Today for a visitor who is not signed in (3.1.0 plan, Access): the public cards, with no names, and
// a way to sign in. A signed-in member is sent home, where their own Today is.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Today · Skills Economy' };

export default async function TodayPage() {
  const identity = await resolveRequestIdentity();
  if (identity?.isAuthenticated) redirect('/');
  return <PublicToday signInUrl={getHostedSignInUrl() ?? '/'} />;
}
