import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ExpensesAdminShell } from '@/components/admin-expenses/expenses-admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminExpensesPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    redirect('/admin');
  }

  return <ExpensesAdminShell />;
}
