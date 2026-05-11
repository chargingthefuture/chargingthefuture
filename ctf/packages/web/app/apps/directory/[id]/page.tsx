
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicDirectoryById } from 'lib/directory/repository';
import { TrustDirectoryProfilePanel } from '@/components/trust/TrustDirectoryProfilePanel';
import type { TrustUserExtension } from 'lib/trust/types';

type DirectoryProfilePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DirectoryProfilePage({ params }: DirectoryProfilePageProps) {
  const { id } = await params;

  const profile = await getPublicDirectoryById(id);

  if (!profile) {
    notFound();
  }

  // TODO: Replace with real trust fetch logic (API call, etc.)
  const trust: TrustUserExtension = {
    userId: profile.id,
    trustStatus: 'unverified',
    trustEvidence: [],
    trustVisibility: 'public',
    updatedAt: new Date().toISOString(),
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      {/* Back link */}
      <div className="mb-6">
        <Link href="/apps/directory" className="text-sm text-blue-600 hover:underline">
          ← Back to Directory
        </Link>
      </div>

      {/* Profile header */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        {/* Trust evidence panel for Directory profile */}
        <TrustDirectoryProfilePanel trust={trust} />
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{profile.displayName}</h1>
            {profile.source === 'community-generated' && (
              <span
                style={{
                  fontSize: 11,
                  background: '#A855F720',
                  color: '#A855F7',
                  border: '1px solid #A855F730',
                  borderRadius: 8,
                  padding: '2px 8px',
                  fontWeight: 700,
                }}
              >
                Community generated
              </span>
            )}
          </div>
          {/* Vanity @handle: Clerk-managed username for claimed profiles,
              auto-generated community-<6hex> for unclaimed. Shown directly
              under the name per design Directory.tsx:76. */}
          {profile.unclaimedHandle && !profile.claimedByUserId && (
            <p className="text-xs font-mono text-muted-foreground mt-1">
              @{profile.unclaimedHandle}
            </p>
          )}
          {profile.headline && <p className="text-lg text-muted-foreground mt-2">{profile.headline}</p>}
          {profile.source === 'community-generated' && profile.invitedByUsername && (
            <p className="text-sm text-muted-foreground mt-2">
              Nominated by{' '}
              <span className="font-mono">@{profile.invitedByUsername}</span>
            </p>
          )}
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap gap-2">
          {profile.sectorName && (
            <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-sm font-medium">
              {profile.sectorName}
            </span>
          )}
          {profile.jobTitleName && (
            <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-sm font-medium">
              {profile.jobTitleName}
            </span>
          )}
        </div>

        {/* Bio */}
        {profile.bio && <p className="text-base leading-relaxed whitespace-pre-wrap">{profile.bio}</p>}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div>
            <h3 className="font-medium text-sm mb-2">Skills</h3>
            <ul className="space-y-1">
              {profile.skills.map((skill) => (
                <li key={skill.id} className="text-sm text-muted-foreground">
                  • {skill.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Payment addresses */}
        <div className="border-t pt-4 space-y-2">
          <h3 className="font-medium text-sm">Payment Methods</h3>
          <div className="text-sm space-y-1">
            {profile.venmoAddress && <p>Venmo: <code className="bg-slate-50 px-2 py-1 rounded">{profile.venmoAddress}</code></p>}
            {profile.bitcoinAddress && <p>Bitcoin: <code className="bg-slate-50 px-2 py-1 rounded text-xs">{profile.bitcoinAddress}</code></p>}
            {profile.moneroAddress && <p>Monero: <code className="bg-slate-50 px-2 py-1 rounded text-xs">{profile.moneroAddress}</code></p>}
            {profile.serviceCreditsAddress && <p>Service Credits: <code className="bg-slate-50 px-2 py-1 rounded">{profile.serviceCreditsAddress}</code></p>}
            {!profile.venmoAddress && !profile.bitcoinAddress && !profile.moneroAddress && !profile.serviceCreditsAddress && (
              <p className="text-muted-foreground">No payment methods listed</p>
            )}
          </div>
        </div>

        {/* External link */}
        {profile.profileUrl && (
          <div className="border-t pt-4">
            <a
              href={profile.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              View profile website →
            </a>
          </div>
        )}

        {/* Metadata */}
        <div className="border-t pt-4 text-xs text-muted-foreground">
          <p>Profile ID: {id}</p>
          <p>Updated: {new Date(profile.updatedAtIso).toLocaleDateString()}</p>
        </div>
      </div>
    </main>
  );
}
