import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ContributorAccessAdminShell } from 'components/contributor-access/contributor-access-admin-shell';

export const dynamic = 'force-dynamic';

// Contributor Access has exactly one surface in this slice: this admin page. There is no member
// view yet (the badge and the gated channel are later slices), so non-admins are redirected to the
// app hub — same gate as /admin/weekly-performance.
export default async function ContributorAccessAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps');
  }

  return <ContributorAccessAdminShell />;
}
