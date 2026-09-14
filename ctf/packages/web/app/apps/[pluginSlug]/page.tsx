import { evaluatePluginAccess, type AllowDecision, type PluginAuthDecision } from 'lib/auth/server-authz';
import { getHostedSignInUrl, withSignInReturn } from 'lib/auth/provider-env';
import {
  canonicalizePluginSlug,
  getPluginBySlug,
  isAdminOnlyPlugin,
  pluginPageMinUnlockTier,
} from 'lib/plugins/repository';
import { getPublicVisitorShell } from '@/components/plugins/public-visitor-registry';
import { ReviewsWidget } from '@/components/reviews/reviews-widget';
import { BeaconShell } from '@/components/beacon/beacon-shell';
import { ChymeShell } from '@/components/chyme/chyme-shell';
import { DirectoryShell } from '@/components/directory/directory-shell';
import { FoundationShell } from '@/components/foundation/foundation-shell';
import GdpShell from '@/components/gdp/gdp-shell';
import { LighthouseShell } from '@/components/lighthouse/lighthouse-shell';
import { SkillUpShell } from '@/components/skill-up/skill-up-shell';
import MoodShell from '@/components/mood/mood-shell';
import { PeerProgrammingShell } from '@/components/peer-programming/peer-programming-shell';
import { ServiceCreditsShell } from '@/components/service-credits/service-credits-shell';
import { SocketRelayShell } from '@/components/socket-relay/socket-relay-shell';
import { SkillsHuntShell } from '@/components/skills-hunt/skills-hunt-shell';
import { SkillsTaxonomyShell } from '@/components/skills-taxonomy/skills-taxonomy-shell';
import { TrustTransportShell } from '@/components/trust-transport/trust-transport-shell';
import { ClickLogShell } from '@/components/click-log/click-log-shell';
import { FiresideShell } from '@/components/fireside/fireside-shell';
import { WhatWorksShell } from '@/components/what-works/what-works-shell';
import { WorkforceShell } from '@/components/workforce/workforce-shell';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

type PluginRoutePageProps = {
  params: Promise<{
    pluginSlug: string;
  }>;
  searchParams: Promise<{
    track?: string;
    status?: string;
    startDate?: string;
    cohortId?: string;
    // Fireside deep link from a blog post: which conversation to open on arrival.
    repo?: string;
    slug?: string;
    title?: string;
  }>;
};

type SelectedPlugin = NonNullable<Awaited<ReturnType<typeof getPluginBySlug>>>;
type DenyDecision = Extract<PluginAuthDecision, { allowed: false }>;
type PluginSearchParams = Awaited<PluginRoutePageProps['searchParams']>;

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

// The denial render for a signed-out visitor or a not-yet-verified member.
//
// Two cases see the plugin's public visitor view rather than a denial wall:
//  - an anonymous visitor (no session) denied with AUTH_UNAUTHORIZED, and
//  - a signed-in but not-yet-verified member denied with `unlock_required`.
// Both can browse the plugin's marketing/landing content the same way; the
// not-yet-verified member is nudged from there toward the Unlock flow, and the
// Hub general channel remains their support surface. Other 403s (e.g. a missing
// username or a role requirement) keep the informative access-denied view.
function renderAccessDenied(decision: DenyDecision, selectedPlugin: SelectedPlugin, returnPath: string) {
  if (decision.code === 'AUTH_UNAUTHORIZED' || decision.reason === 'unlock_required') {
    const PublicVisitorShell = getPublicVisitorShell(selectedPlugin.slug);
    // Sign-in is hosted elsewhere and returns to the home page by default. Somebody who followed a
    // link to one specific place — a blog reader joining one conversation — would arrive at
    // twenty-five tiles with no sign of what they came for, and leave. The destination rides along.
    const hostedSignIn = getHostedSignInUrl();
    const signInUrl = hostedSignIn ? withSignInReturn(hostedSignIn, returnPath) : '/sign-in';
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
          pluginSlug={selectedPlugin.slug}
          pluginName={selectedPlugin.name}
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
      requestedPluginSlug={selectedPlugin.slug}
    />
  );
}

// The shell dispatch is split across three small helpers purely to keep each function under the
// rule-116 complexity limit; each keeps the `selectedPlugin.slug === '<slug>'` idiom that
// check-web-android-parity.mjs scans for, so the parity gate still detects every explicit web shell.
// A helper returns null for a slug it does not own; the caller tries them in order.
// Fireside opens on one conversation when the link names one. A reader comes from a blog post, so
// landing on their own comment list — empty, for somebody who has never written here — would lose
// them the thing they clicked for.
//
// Its page gate is a signed-in account rather than full approval (pluginPageMinUnlockTier), matching
// its API and the Unlock exception decided for it: writing here is a route into verification, so a
// wall in front of the comment box would defeat the exception. Nothing an unapproved member writes
// is publicly visible.
function renderFireside(decision: AllowDecision, query: PluginSearchParams): ReactNode {
  const repo = query.repo?.trim();
  const slug = query.slug?.trim();
  return (
    <FiresideShell
      isAdmin={decision.isAdmin}
      initialPost={repo && slug ? { repo, slug, title: query.title?.trim() ?? '' } : null}
    />
  );
}

function renderPluginShellA(
  selectedPlugin: SelectedPlugin,
  decision: AllowDecision,
  query: PluginSearchParams,
): ReactNode | null {
  if (selectedPlugin.slug === 'beacon') {
    return <BeaconShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'click-log') {
    return <ClickLogShell isAdmin={decision.isAdmin} />;
  }

  if (selectedPlugin.slug === 'what-works') {
    return <WhatWorksShell />;
  }

  if (selectedPlugin.slug === 'fireside') {
    return renderFireside(decision, query);
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

  return null;
}

function renderPluginShellB(selectedPlugin: SelectedPlugin, decision: AllowDecision): ReactNode | null {
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

  return null;
}

function renderPluginShellC(
  selectedPlugin: SelectedPlugin,
  decision: AllowDecision,
  query: PluginSearchParams,
): ReactNode | null {
  if (selectedPlugin.slug === 'mood') {
    return <MoodShell />;
  }

  if (selectedPlugin.slug === 'trust') {
    // Trust has no screen of its own. A member's trust card — their own signals, and under it the
    // exact rows other members receive — is built into the account hub, and that is the only place
    // it ships. Without this branch a signed-in member who tapped Trust in the apps list fell
    // through to GenericPluginView below and got the baseline-access debug page: their user id, the
    // availability state, and a link home. That page is a routing check, not a product surface.
    //
    // Deliberately placed AFTER the access gate rather than beside the knowledge redirect above.
    // A signed-out visitor and a not-yet-verified member are denied before this point and keep
    // getting the Trust public landing page, which is correct and is what they see today; only a
    // member who actually passed the gate is sent to the hub, where they have a card to look at.
    redirect('/account');
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

  if (selectedPlugin.slug === 'skill-up') {
    return <SkillUpShell userId={decision.userId} isAdmin={decision.isAdmin} query={query} />;
  }

  return null;
}

// Knowledge and TI Radio redirect BEFORE the access gate, not from the shell branches. Its real page is the
// top-level /knowledge route, which is open to any signed-in member (owner decision, 2026-07-29)
// and carries its own signed-out landing — the page the Quora invitation links to. When this
// redirect sat after the gate, only fully-verified members ever reached it: a signed-out visitor
// got the generic sign-in card and a not-yet-verified member got the Unlock nudge, both wrong for
// a page whose whole point is to be readable before joining. `redirect` throws, so returning is
// only reached for every other plugin.
//
// Takes the whole plugin and compares `selectedPlugin.slug` rather than a bare slug string: the
// web/android parity gate discovers which slugs have an explicit web shell by scanning this file
// for that exact expression, so renaming the variable made knowledge disappear from the scan and
// failed the gate.
function redirectKnowledgeBeforeGate(selectedPlugin: SelectedPlugin): void {
  if (selectedPlugin.slug === 'knowledge') {
    redirect('/knowledge');
  }

  // TI Radio redirects before the gate for the same reason. Its real page is the top-level
  // /ti-radio route, which anybody can read with no account — it is a broadcast guide, written for
  // people arriving from the Quora space who have not joined yet. Behind the gate a signed-out
  // visitor would get the generic sign-in card instead of the schedule, which is the opposite of
  // what the page is for. Booking a slot on it still needs full Unlock approval.
  if (selectedPlugin.slug === 'ti-radio') {
    redirect('/ti-radio');
  }
}

// Where to come back to after signing in: this page, with the query that brought them here, so a
// deep link into one conversation survives the round trip through the hosted sign-in page.
function buildReturnPath(slug: string, query: PluginSearchParams): string {
  const search = new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  return `/apps/${slug}${search ? `?${search}` : ''}`;
}

export default async function PluginRoutePage({ params, searchParams }: PluginRoutePageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const requestedPluginSlug = canonicalizePluginSlug(resolvedParams.pluginSlug);
  const selectedPlugin = await getPluginBySlug(requestedPluginSlug);

  if (!selectedPlugin || !selectedPlugin.isVisible) {
    notFound();
  }

  redirectKnowledgeBeforeGate(selectedPlugin);

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
  const decision = await evaluatePluginAccess({
    requireUsername: false,
    minUnlockTier: pluginPageMinUnlockTier(selectedPlugin.slug),
  });

  const returnPath = buildReturnPath(selectedPlugin.slug, resolvedSearchParams);

  // Operator-only plugins (e.g. Weekly Performance) are admin-only: a non-admin gets a 404 for the
  // route, not the public landing, since there is no approved user-facing version. Admins fall
  // through to the normal render below.
  if (isAdminOnlyPlugin(selectedPlugin.slug) && !(decision.allowed && decision.isAdmin)) {
    notFound();
  }

  if (!decision.allowed) {
    return renderAccessDenied(decision, selectedPlugin, returnPath);
  }

  const shell =
    renderPluginShellA(selectedPlugin, decision, resolvedSearchParams) ??
    renderPluginShellB(selectedPlugin, decision) ??
    renderPluginShellC(selectedPlugin, decision, resolvedSearchParams);

  if (shell) {
    return shell;
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
