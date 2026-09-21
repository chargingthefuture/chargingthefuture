import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { WeeklyPerformanceSignInRecordShell } from 'components/weekly-performance/wp-sign-in-record-shell';

export const dynamic = 'force-dynamic';

// The sign-in record behind the dashboard's Active Members and Daily Active Members rows, read as
// a health check: is the write landing, and if not, what does the database say.
export default async function WeeklyPerformanceSignInRecordPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps');
  }

  return <WeeklyPerformanceSignInRecordShell />;
}
