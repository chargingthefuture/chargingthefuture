import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { WeeklyPerformanceAdminShell } from 'components/weekly-performance/wp-admin-shell';

export const dynamic = 'force-dynamic';

export default async function WeeklyPerformanceAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/weekly-performance');
  }

  return <WeeklyPerformanceAdminShell />;
}
