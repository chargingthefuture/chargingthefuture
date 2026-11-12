import type { ReactNode } from 'react';
import { isDemoMode } from 'lib/feature-flags/system';
import { AdminDemoBanner } from '@/components/shared/admin-demo-banner';
import { AdminRefreshProvider } from '@/components/shared/admin-refresh';
import { AdminSeScope } from '@/components/shared/admin-se-scope';

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

  // AdminSeScope draws every admin screen in the member's 3.1 colors (SOCIAL_REDESIGN_3_1_PLAN.md:
  // admin screens are restyled and reached from Me's System Architect badge).
  return (
    <AdminSeScope>
      {demo ? <AdminDemoBanner /> : null}
      {/* Every /admin screen gets a refresh control in its top bar, driven from here so the pending
          state and the remount survive the subtree being re-read. See components/shared/admin-refresh.tsx
          for why an admin screen needs both a server re-render and a remount. */}
      <AdminRefreshProvider>{children}</AdminRefreshProvider>
    </AdminSeScope>
  );
}
