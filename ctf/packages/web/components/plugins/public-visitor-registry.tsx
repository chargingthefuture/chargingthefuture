import type { ComponentType } from 'react';
import { BeaconPublicShell } from '@/components/beacon/beacon-public-shell';
import { ChymePublicShell } from '@/components/chyme/chyme-public-shell';
import { ClickLogPublicShell } from '@/components/click-log/click-log-public-shell';
import { ContributionsPublicShell } from '@/components/contributions/contributions-public-shell';
import { DirectoryPublicShell } from '@/components/directory/directory-public-shell';
import { FoundationPublicShell } from '@/components/foundation/foundation-public-shell';
import { GdpPublicShell } from '@/components/gdp/gdp-public-shell';
import { SkillUpPublicShell } from '@/components/skill-up/skill-up-public-shell';
import { LighthousePublicShell } from '@/components/lighthouse/lighthouse-public-shell';
import { MoodPublicShell } from '@/components/mood/mood-public-shell';
import { PeerProgrammingPublicShell } from '@/components/peer-programming/peer-programming-public-shell';
import { RecurringActivityPublicShell } from '@/components/recurring-activity/recurring-activity-public-shell';
import { ServiceCreditsPublicShell } from '@/components/service-credits/service-credits-public-shell';
import { SkillsHuntPublicShell } from '@/components/skills-hunt/skills-hunt-public-shell';
import { SkillsTaxonomyPublicShell } from '@/components/skills-taxonomy/skills-taxonomy-public-shell';
import { SocketRelayPublicShell } from '@/components/socket-relay/socket-relay-public-shell';
import { TrustPublicShell } from '@/components/trust/trust-public-shell';
import { TrustTransportPublicShell } from '@/components/trust-transport/trust-transport-public-shell';
import { WhatWorksPublicShell } from '@/components/what-works/what-works-public-shell';
import { WorkforcePublicShell } from '@/components/workforce/workforce-public-shell';
import { GenericPublicShell } from '@/components/plugins/generic-public-shell';

/**
 * Props every plugin's public (signed-out visitor) shell receives.
 *
 * A public shell shows marketing / empty-state content only — it must never
 * fetch or display private or per-user data, because the visitor has no session.
 * The hosted sign-in URL lets the visitor start signing in from the public view.
 */
export type PublicVisitorShellProps = {
  pluginSlug: string;
  pluginName: string;
  signInUrl: string;
  /**
   * When present, the viewer is a signed-in member who is not verified yet, so
   * the shell shows a single "Finish verifying" call-to-action pointing at this
   * URL (the Unlock flow) instead of its sign-in / sign-up CTAs. When absent
   * (the default), the viewer is an anonymous visitor and the shell renders its
   * normal "Sign In / Join Free" CTAs unchanged.
   */
  verifyUrl?: string;
};

export type PublicVisitorShell = ComponentType<PublicVisitorShellProps>;

/**
 * Registry mapping a plugin slug to its signed-out public visitor shell.
 *
 * To add a public view for another plugin: build its
 * `components/<plugin>/<plugin>-public-shell.tsx` from that plugin's
 * `<Plugin>Public.tsx` design mockup, then add one line here mapping the slug to
 * the component. No change to the route page is needed. Plugins not listed here
 * fall back to `GenericPublicShell`, so a signed-out visitor never hits a 500 or
 * the access-denied wall.
 */
const PUBLIC_VISITOR_SHELLS: Record<string, PublicVisitorShell> = {
  beacon: BeaconPublicShell,
  chyme: ChymePublicShell,
  'click-log': ClickLogPublicShell,
  contributions: ContributionsPublicShell,
  directory: DirectoryPublicShell,
  foundation: FoundationPublicShell,
  gdp: GdpPublicShell,
  'skill-up': SkillUpPublicShell,
  lighthouse: LighthousePublicShell,
  mood: MoodPublicShell,
  'peer-programming': PeerProgrammingPublicShell,
  'recurring-activity': RecurringActivityPublicShell,
  'service-credits': ServiceCreditsPublicShell,
  'skills-hunt': SkillsHuntPublicShell,
  'skills-taxonomy': SkillsTaxonomyPublicShell,
  'socket-relay': SocketRelayPublicShell,
  trust: TrustPublicShell,
  'trust-transport': TrustTransportPublicShell,
  // weekly-performance has no entry on purpose: it is admin-only, and the /apps/[pluginSlug] route
  // 404s non-admins before the public-shell branch is ever reached, so a public shell for it would
  // be unreachable dead code (its shell was deleted for that reason, like the Unlock one before it).
  'what-works': WhatWorksPublicShell,
  workforce: WorkforcePublicShell,
};

/**
 * Returns the public visitor shell for a plugin slug, or the generic fallback
 * when that plugin's public shell has not been built yet.
 */
export function getPublicVisitorShell(pluginSlug: string): PublicVisitorShell {
  return PUBLIC_VISITOR_SHELLS[pluginSlug] ?? GenericPublicShell;
}
