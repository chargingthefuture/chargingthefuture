// Operator-only surfaces: real plugins that should not appear in the user app launcher and
// whose /apps/<slug> route is gated to admins. Admins still see and use them; everyone else
// neither sees the tile nor can open the route. Kept in code (not the DB registry) so it holds
// whether the registry is served from the database or the in-code fallback.
// mutual-time: admins create/manage the polls; members only ever vote via a shared event link
// (/mutual-time/<slug>), never from a launcher tile — so it does not belong in the member apps list.
// Kept reachable at /apps/mutual-time for admins (via the admin grid); just hidden from members here.
//
// Its own module, with no database import, so a client component (the announcement plugin picker)
// can read the same list the server checks.
export const ADMIN_ONLY_PLUGIN_SLUGS = new Set<string>(['mutual-time']);

export function isAdminOnlyPlugin(slug: string): boolean {
  return ADMIN_ONLY_PLUGIN_SLUGS.has(slug);
}
