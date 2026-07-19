import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { WeeklyPerformanceShell } from 'components/weekly-performance/weekly-performance-shell';

export const dynamic = 'force-dynamic';

// Weekly Performance has exactly one surface: this admin page, which serves the full dashboard.
// There is no member view — /apps/weekly-performance redirects admins here and 404s everyone else.
export default async function WeeklyPerformanceAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps');
  }

  return <WeeklyPerformanceShell />;
}
