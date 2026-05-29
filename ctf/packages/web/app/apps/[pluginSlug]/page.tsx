// ...existing code...
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { canonicalizePluginSlug, getPluginBySlug } from 'lib/plugins/repository';
import { ChymeShell } from '@/components/chyme/chyme-shell';
import { DirectoryShell } from '@/components/directory/directory-shell';
import { FeedAnnouncementsShell } from '@/components/feed/feed-announcements-shell';
import { FoundationShell } from '@/components/foundation/foundation-shell';
import GdpShell from '@/components/gdp/gdp-shell';
import { GentlePulseShell } from '@/components/gentlepulse/gentlepulse-shell';
import { LighthouseShell } from '@/components/lighthouse/lighthouse-shell';
import { LevelupShell } from '@/components/levelup/levelup-shell';
import MoodShell from '@/components/mood/mood-shell';
import { PeerProgrammingShell } from '@/components/peer-programming/peer-programming-shell';
import { ServiceCreditsShell } from '@/components/service-credits/service-credits-shell';
import { SocketRelayShell } from '@/components/socketrelay/socketrelay-shell';
import { SkillsHuntShell } from '@/components/skills-hunt/skills-hunt-shell';
import { SkillsTaxonomyShell } from '@/components/skills-taxonomy/skills-taxonomy-shell';
import { TrustTransportShell } from '@/components/trusttransport/trusttransport-shell';
import { WeeklyPerformanceShell } from '@/components/weekly-performance/weekly-performance-shell';
import { ClicklogShell } from '@/components/clicklog/clicklog-shell';
import { WorkforceShell } from '@/components/workforce/workforce-shell';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type PluginRoutePageProps = {
  params: Promise<{
    pluginSlug: string;
  }>;
  searchParams: Promise<{
    track?: string;
    status?: string;
    startDate?: string;
    cohortId?: string;
  }>;
};

type AccessDeniedProps = {
  status: number;
  code: string;
  reason: string;
  requestedPluginSlug: string;
};

function AccessDeniedView({ status, code, reason, requestedPluginSlug }: AccessDeniedProps) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Plugin access denied</h1>
      <p className="text-sm text-muted-foreground">
        Request blocked by baseline plugin auth policy.
      </p>
      <dl className="rounded-lg border bg-card p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-medium">HTTP status</dt>
          <dd>{status}</dd>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <dt className="font-medium">Deny code</dt>
          <dd>{code}</dd>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <dt className="font-medium">Reason</dt>
          <dd>{reason}</dd>
        </div>
      </dl>
      <p>Requested plugin: {requestedPluginSlug}</p>
      {reason === 'missing_username' ? (
        <p className="text-sm">
          Username is required for this plugin route. Update your profile username and try again.
        </p>
      ) : null}
      {reason === 'unlock_support_only' ? (
        <p className="text-sm">
          This account is currently limited to support access only. Open Chyme to continue with customer service community chat while verification is unresolved.
        </p>
      ) : null}
      <p className="text-sm">
        <Link className="underline underline-offset-4" href="/">Return to home</Link>
      </p>
    </main>
  );
}

type GenericPluginViewProps = {
  userId: string;
  username: string | null;
  selectedPluginSlug: string;
  selectedPluginName: string;
  availabilityState: string;
};

function GenericPluginView({
  userId,
  username,
  selectedPluginSlug,
  selectedPluginName,
  availabilityState,
}: GenericPluginViewProps) {
  const isPlanned = availabilityState === 'planned';

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isPlanned ? 'Plugin route active (planned implementation)' : 'Plugin baseline access confirmed'}
      </h1>
      <p className="text-sm text-muted-foreground">
        Route access passed middleware and server-side policy checks.
      </p>
      <dl className="rounded-lg border bg-card p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Authenticated user</dt>
          <dd>{userId}</dd>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <dt className="font-medium">Username handle</dt>
          <dd>{username ?? 'not set'}</dd>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <dt className="font-medium">Selected plugin</dt>
          <dd>{selectedPluginName}</dd>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <dt className="font-medium">Availability</dt>
          <dd>{availabilityState}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">Selected plugin slug: {selectedPluginSlug}</p>
      <p className="text-sm">
        <Link className="underline underline-offset-4" href="/">Return to home</Link>
      </p>
    </main>
  );
}

export default async function PluginRoutePage({ params, searchParams }: PluginRoutePageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const requestedPluginSlug = canonicalizePluginSlug(resolvedParams.pluginSlug);
  const selectedPlugin = await getPluginBySlug(requestedPluginSlug);

  if (!selectedPlugin || !selectedPlugin.isVisible) {
    notFound();
  }

  const shouldRequireUsername = selectedPlugin.slug !== 'chyme';
  const decision = await evaluatePluginAccess({
    requireUsername: shouldRequireUsername,
    allowUnlockSupportOnly: selectedPlugin.slug === 'chyme',
    requireApprovedUserOrAdmin: selectedPlugin.slug === 'chyme',
  });

  if (!decision.allowed) {
    return (
      <AccessDeniedView
        status={decision.status}
        code={decision.code}
        reason={decision.reason}
        requestedPluginSlug={selectedPlugin.slug}
      />
    );
  }

  if (selectedPlugin.slug === 'clicklog') {
    return <ClicklogShell userId={decision.userId} />;
  }

  if (selectedPlugin.slug === 'chyme') {
    return (
      <ChymeShell
        currentUser={{
          userId: decision.userId,
          username: decision.username,
          displayName: decision.username ? `@${decision.username}` : `user-${decision.userId.slice(0, 8)}`,
        }}
      />
    );
  }

  if (selectedPlugin.slug === 'directory') {
    return <DirectoryShell />;
  }

  if (selectedPlugin.slug === 'feed-announcements') {
    return (
      <FeedAnnouncementsShell
        userId={decision.userId}
        role={decision.role}
        isAdmin={decision.isAdmin}
      />
    );
  }

  if (selectedPlugin.slug === 'workforce') {
    return <WorkforceShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'skills-hunt') {
    return <SkillsHuntShell userId={decision.userId} isAdmin={decision.isAdmin} isModerator={decision.role === 'moderator'} />;
  }

  if (selectedPlugin.slug === 'skills-taxonomy') {
    return <SkillsTaxonomyShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'foundation') {
    return <FoundationShell userId={decision.userId} isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'lighthouse') {
    return <LighthouseShell userId={decision.userId} isAdmin={decision.isAdmin} role={decision.role} />;
  }

  if (selectedPlugin.slug === 'socketrelay') {
    return <SocketRelayShell userId={decision.userId} isAdmin={decision.isAdmin} role={decision.role} />;
  }

  if (selectedPlugin.slug === 'trusttransport') {
    return <TrustTransportShell userId={decision.userId} isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'peer-programming') {
    return <PeerProgrammingShell userId={decision.userId} isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'mood') {
    return <MoodShell />;
  }

  if (selectedPlugin.slug === 'gentlepulse') {
    return <GentlePulseShell />;
  }

  if (selectedPlugin.slug === 'weekly-performance') {
    return <WeeklyPerformanceShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'gdp') {
    return <GdpShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'service-credits') {
    return <ServiceCreditsShell userId={decision.userId} isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'levelup') {
    return <LevelupShell userId={decision.userId} isAdmin={decision.isAdmin} query={resolvedSearchParams} />;
  }

  return (
    <GenericPluginView
      userId={decision.userId}
      username={decision.username}
      selectedPluginSlug={selectedPlugin.slug}
      selectedPluginName={selectedPlugin.name}
      availabilityState={selectedPlugin.availabilityState}
    />
  );
}
