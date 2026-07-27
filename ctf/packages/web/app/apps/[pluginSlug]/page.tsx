import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { canonicalizePluginSlug, getPluginBySlug, isAdminOnlyPlugin } from 'lib/plugins/repository';
import { getPublicVisitorShell } from '@/components/plugins/public-visitor-registry';
import { BeaconShell } from '@/components/beacon/beacon-shell';
import { ChymeShell } from '@/components/chyme/chyme-shell';
import { DirectoryShell } from '@/components/directory/directory-shell';
import { FoundationShell } from '@/components/foundation/foundation-shell';
import GdpShell from '@/components/gdp/gdp-shell';
import { LighthouseShell } from '@/components/lighthouse/lighthouse-shell';
import { LevelUpShell } from '@/components/level-up/level-up-shell';
import MoodShell from '@/components/mood/mood-shell';
import { PeerProgrammingShell } from '@/components/peer-programming/peer-programming-shell';
import { ServiceCreditsShell } from '@/components/service-credits/service-credits-shell';
import { SocketRelayShell } from '@/components/socket-relay/socket-relay-shell';
import { SkillsHuntShell } from '@/components/skills-hunt/skills-hunt-shell';
import { SkillsTaxonomyShell } from '@/components/skills-taxonomy/skills-taxonomy-shell';
import { TrustTransportShell } from '@/components/trust-transport/trust-transport-shell';
import { ClickLogShell } from '@/components/click-log/click-log-shell';
import { WhatWorksShell } from '@/components/what-works/what-works-shell';
import { WorkforceShell } from '@/components/workforce/workforce-shell';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

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

  // Every plugin route requires full Unlock access (the default minUnlockTier
  // 'approved_full'). A not-yet-verified member is denied with `unlock_required` and
  // shown the plugin's public landing page below (not the access-denied view), which
  // nudges them toward the Unlock flow; the Hub general channel is their support surface.
  //
  // No plugin route requires a username. Every plugin API already gates with
  // `requireUsername: false`, and members can be approved on a temporary handle before they
  // choose a username in Clerk. Requiring one here blocked those members from opening apps
  // (a leftover: it produced a 403 `missing_username` page), so the page gate matches the
  // APIs and does not require a username. Shells that show the handle fall back gracefully
  // when it is null.
  const decision = await evaluatePluginAccess({ requireUsername: false });

  // Operator-only plugins (e.g. Weekly Performance) are admin-only: a non-admin gets a 404 for the
  // route, not the public landing, since there is no approved user-facing version. Admins fall
  // through to the normal render below.
  if (isAdminOnlyPlugin(selectedPlugin.slug) && !(decision.allowed && decision.isAdmin)) {
    notFound();
  }

  if (!decision.allowed) {
    // Two cases see the plugin's public visitor view rather than a denial wall:
    //  - an anonymous visitor (no session) denied with AUTH_UNAUTHORIZED, and
    //  - a signed-in but not-yet-verified member denied with `unlock_required`.
    // Both can browse the plugin's marketing/landing content the same way; the
    // not-yet-verified member is nudged from there toward the Unlock flow, and the
    // Hub general channel remains their support surface. Other 403s (e.g. a missing
    // username or a role requirement) keep the informative access-denied view.
    if (decision.code === 'AUTH_UNAUTHORIZED' || decision.reason === 'unlock_required') {
      const PublicVisitorShell = getPublicVisitorShell(selectedPlugin.slug);
      const signInUrl = getHostedSignInUrl() ?? '/sign-in';
      // A signed-in-but-not-yet-verified member (denied with `unlock_required`)
      // is already authenticated, so the public shell's "Sign In / Join Free"
      // CTAs are wrong for them; pass a verifyUrl so the shell shows a single
      // "Finish verifying" action pointing at the Unlock flow instead. An
      // anonymous visitor (AUTH_UNAUTHORIZED) gets no verifyUrl and sees the
      // normal sign-in / sign-up CTAs.
      const verifyUrl = decision.reason === 'unlock_required' ? '/plugin/unlock' : undefined;
      // The back-to-/apps control lives inside each public shell's own header
      // row (PublicShellBackLink), so no wrapping frame is needed here.
      return (
        <PublicVisitorShell
          pluginSlug={selectedPlugin.slug}
          pluginName={selectedPlugin.name}
          signInUrl={signInUrl}
          verifyUrl={verifyUrl}
        />
      );
    }

    return (
      <AccessDeniedView
        status={decision.status}
        code={decision.code}
        reason={decision.reason}
        requestedPluginSlug={selectedPlugin.slug}
      />
    );
  }

  if (selectedPlugin.slug === 'beacon') {
    return <BeaconShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'click-log') {
    return <ClickLogShell />;
  }

  if (selectedPlugin.slug === 'what-works') {
    return <WhatWorksShell />;
  }

  if (selectedPlugin.slug === 'chyme') {
    return (
      <ChymeShell
        currentUser={{
          userId: decision.userId,
          username: decision.username,
        }}
      />
    );
  }

  if (selectedPlugin.slug === 'directory') {
    return <DirectoryShell userId={decision.userId} isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'workforce') {
    return <WorkforceShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'skills-hunt') {
    return <SkillsHuntShell userId={decision.userId} isAdmin={decision.isAdmin} isModerator={decision.role === 'moderator'} />;
  }

  if (selectedPlugin.slug === 'skills-taxonomy') {
    return <SkillsTaxonomyShell />;
  }

  if (selectedPlugin.slug === 'foundation') {
    return <FoundationShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'lighthouse') {
    return <LighthouseShell userId={decision.userId} username={decision.username} isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'socket-relay') {
    return <SocketRelayShell userId={decision.userId} isAdmin={decision.isAdmin} role={decision.role} />;
  }

  if (selectedPlugin.slug === 'trust-transport') {
    return <TrustTransportShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'peer-programming') {
    return <PeerProgrammingShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'mood') {
    return <MoodShell />;
  }

  if (selectedPlugin.slug === 'weekly-performance') {
    // Weekly Performance has no member view — the dashboard lives on the admin page only.
    // Non-admins never reach this branch (the admin-only gate above 404s them).
    redirect('/admin/weekly-performance');
  }

  if (selectedPlugin.slug === 'gdp') {
    return <GdpShell />;
  }

  if (selectedPlugin.slug === 'service-credits') {
    return <ServiceCreditsShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'level-up') {
    return <LevelUpShell userId={decision.userId} isAdmin={decision.isAdmin} query={resolvedSearchParams} />;
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
