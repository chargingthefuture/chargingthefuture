import type { ComponentType } from 'react';
import { ChymePublicShell } from '@/components/chyme/chyme-public-shell';
import { ClicklogPublicShell } from '@/components/clicklog/clicklog-public-shell';
import { DirectoryPublicShell } from '@/components/directory/directory-public-shell';
import { FoundationPublicShell } from '@/components/foundation/foundation-public-shell';
import { GdpPublicShell } from '@/components/gdp/gdp-public-shell';
import { GentlePulsePublicShell } from '@/components/gentlepulse/gentlepulse-public-shell';
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
  chyme: ChymePublicShell,
  clicklog: ClicklogPublicShell,
  directory: DirectoryPublicShell,
  foundation: FoundationPublicShell,
  gdp: GdpPublicShell,
  gentlepulse: GentlePulsePublicShell,
};

/**
 * Returns the public visitor shell for a plugin slug, or the generic fallback
 * when that plugin's public shell has not been built yet.
 */
export function getPublicVisitorShell(pluginSlug: string): PublicVisitorShell {
  return PUBLIC_VISITOR_SHELLS[pluginSlug] ?? GenericPublicShell;
}
