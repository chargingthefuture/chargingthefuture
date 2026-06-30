import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { DirectoryShell } from '@/components/directory/directory-shell';

// Auth-gated deep link to one directory profile (the destination a shared ShareLink points at).
// A signed-in member lands on the Directory opened to this profile's detail; an unauthenticated (or
// otherwise not-allowed) visitor is redirected to the directory landing — no profile data is exposed
// without auth, matching v3's directory privacy model. The `handle` segment is the profile id.
export const dynamic = 'force-dynamic';

export default async function DirectoryProfileDeepLinkPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    redirect('/apps/directory');
  }

  return <DirectoryShell userId={decision.userId} isAdmin={decision.isAdmin} initialProfileId={handle} />;
}
