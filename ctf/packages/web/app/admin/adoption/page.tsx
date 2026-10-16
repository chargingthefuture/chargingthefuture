import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { AdoptionShell } from '@/components/adoption/adoption-shell';

export const dynamic = 'force-dynamic';

// Adoption: the steps toward 384, the daily exchange and badge, Weekly Performance and its sign-in
// record, on one admin screen. Each API route it reads does its own admin check as well.
export default async function AdoptionAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps');
  }

  return <AdoptionShell />;
}
