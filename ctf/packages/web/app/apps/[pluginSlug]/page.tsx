import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import type { PluginDenyResponse } from 'lib/auth/deny-taxonomy';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import {
  canonicalizePluginSlug,
  getPluginBySlug,
  isAdminOnlyPlugin,
  type PluginRegistryItem,
} from 'lib/plugins/repository';
import type { ReactNode } from 'react';
import { getPublicVisitorShell } from '@/components/plugins/public-visitor-registry';
import { ReviewsWidget } from '@/components/reviews/reviews-widget';
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

type PluginShellContext = {
  decision: AllowDecision;
  plugin: PluginRegistryItem;
  searchParams: {
    track?: string;
    status?: string;
    startDate?: string;
    cohortId?: string;
  };
};

// Maps each plugin slug to the shell it renders once baseline access is allowed. Kept as a data
// table so the route handler stays a simple lookup instead of a long branch chain; the props each
// shell needs are read from the shared access context. `knowledge` and `weekly-performance`
// redirect to their canonical routes instead of rendering a shell here. A slug with no entry falls
// through to the generic plugin view.
const PLUGIN_SHELL_RENDERERS: Record<string, (ctx: PluginShellContext) => ReactNode> = {
  beacon: ({ decision }) => <BeaconShell isAdmin={decision.isAdmin} />,
  'click-log': () => <ClickLogShell />,
  'what-works': () => <WhatWorksShell />,
  chyme: ({ decision }) => (
    <ChymeShell
      currentUser={{
        userId: decision.userId,
        username: decision.username,
      }}
    />
  ),
  directory: ({ decision }) => <DirectoryShell userId={decision.userId} isAdmin={decision.isAdmin} />,
  workforce: ({ decision }) => <WorkforceShell isAdmin={decision.isAdmin} />,
  'skills-hunt': ({ decision }) => (
    <SkillsHuntShell
      userId={decision.userId}
      isAdmin={decision.isAdmin}
      isModerator={decision.role === 'moderator'}
    />
  ),
  'skills-taxonomy': () => <SkillsTaxonomyShell />,
  foundation: ({ decision }) => <FoundationShell isAdmin={decision.isAdmin} />,
  lighthouse: ({ decision }) => (
    <LighthouseShell userId={decision.userId} username={decision.username} isAdmin={decision.isAdmin} />
  ),
  'socket-relay': ({ decision }) => (
    <SocketRelayShell userId={decision.userId} isAdmin={decision.isAdmin} role={decision.role} />
  ),
  'trust-transport': ({ decision }) => <TrustTransportShell isAdmin={decision.isAdmin} />,
  'peer-programming': ({ decision }) => <PeerProgrammingShell isAdmin={decision.isAdmin} />,
  mood: () => <MoodShell />,
  // The real page is the top-level /knowledge route — short enough to paste into an invitation post
  // that is read outside the app. The launcher tile lands here and is sent on, so there is one page
  // rather than two copies to keep in step.
  knowledge: () => redirect('/knowledge'),
  // Weekly Performance has no member view — the dashboard lives on the admin page only.
  // Non-admins never reach this branch (the admin-only gate above 404s them).
  'weekly-performance': () => redirect('/admin/weekly-performance'),
  gdp: () => <GdpShell />,
  'service-credits': ({ decision }) => <ServiceCreditsShell isAdmin={decision.isAdmin} />,
  'level-up': ({ decision, searchParams }) => (
    <LevelUpShell userId={decision.userId} isAdmin={decision.isAdmin} query={searchParams} />
  ),
};

// A denied request either browses the plugin's public landing (anonymous or not-yet-verified) or
// sees the informative access-denied view (other 403s). Extracted so the route handler stays flat.
function renderAccessDenied(decision: PluginDenyResponse, plugin: PluginRegistryItem): ReactNode {
  // Two cases see the plugin's public visitor view rather than a denial wall:
  //  - an anonymous visitor (no session) denied with AUTH_UNAUTHORIZED, and
  //  - a signed-in but not-yet-verified member denied with `unlock_required`.
  // Both can browse the plugin's marketing/landing content the same way; the
  // not-yet-verified member is nudged from there toward the Unlock flow, and the
  // Hub general channel remains their support surface. Other 403s (e.g. a missing
  // username or a role requirement) keep the informative access-denied view.
  if (decision.code === 'AUTH_UNAUTHORIZED' || decision.reason === 'unlock_required') {
    const PublicVisitorShell = getPublicVisitorShell(plugin.slug);
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
      <>
        <PublicVisitorShell
          pluginSlug={plugin.slug}
          pluginName={plugin.name}
          signInUrl={signInUrl}
          verifyUrl={verifyUrl}
        />
        {/* Corner reviews widget — shown on every public (signed-out) plugin page. */}
        <ReviewsWidget />
      </>
    );
  }

  return (
    <AccessDeniedView
      status={decision.status}
      code={decision.code}
      reason={decision.reason}
      requestedPluginSlug={plugin.slug}
    />
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
    return renderAccessDenied(decision, selectedPlugin);
  }

  const renderShell = PLUGIN_SHELL_RENDERERS[selectedPlugin.slug];
  if (renderShell) {
    return renderShell({
      decision,
      plugin: selectedPlugin,
      searchParams: resolvedSearchParams,
    });
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
