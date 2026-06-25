import type { ReactNode } from 'react';
import { isDemoMode } from 'lib/feature-flags/system';
import { AdminDemoBanner } from '@/components/shared/admin-demo-banner';

// Applies to every /admin/* screen. When the signed-in operator is a demo participant, getActivePool
// routes their admin actions to the demo schema, which is easy to miss and makes operations like
// "Retry pending rewards" or a governance burn silently act on demo data (a burn against an empty demo
// wallet just fails as "Insufficient balance."). A loud banner keeps the operator aware of which
// environment their actions affect. Best-effort: if the flag layer cannot resolve, show no banner (the
// normal production view) rather than failing the page.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  let demo = false;
  try {
    demo = await isDemoMode();
  } catch {
    demo = false;
  }

  return (
    <>
      {demo ? <AdminDemoBanner /> : null}
      {children}
    </>
  );
}
