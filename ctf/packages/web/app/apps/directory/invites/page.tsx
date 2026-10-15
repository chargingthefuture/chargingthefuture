import { notFound, redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { resolveInviteViewer } from 'lib/directory/invite-access';
import { normalizeInviteHandle } from 'lib/directory/invite-input';
import { getPluginBySlug } from 'lib/plugins/repository';
import { DirectoryInviteWall } from '@/components/directory/directory-invite-wall';

// The Directory invite wall in full, for any signed-in account (owner decision, 2026-10-15; the gate
// is lib/directory/invite-access.ts). A signed-out visitor is sent to /apps/directory, which shows the
// cards a visitor may see. Static segment, so it wins over the [handle] redirect beside it.
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ page?: string; invite?: string }> };

export default async function DirectoryInvitesPage({ searchParams }: Props) {
  const query = await searchParams;
  const handle = normalizeInviteHandle(query.invite) ?? undefined;

  const directory = await getPluginBySlug('directory');
  if (!directory || !directory.isVisible) {
    notFound();
  }

  const viewer = await resolveInviteViewer();
  if (viewer.kind !== 'member') {
    redirect(handle ? `/apps/directory?invite=${encodeURIComponent(handle)}` : '/apps/directory');
  }

  // Only to choose between the ask to finish the check and the link back into the Directory.
  const approved = (await evaluatePluginAccess({ requireUsername: false })).allowed;
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);

  return <DirectoryInviteWall page={page} inviteHandle={handle} verifyUrl={approved ? undefined : '/plugin/unlock'} />;
}
