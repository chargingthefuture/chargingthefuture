import { NextResponse } from 'next/server';
import { listPluginRegistryWithSummary, filterPluginsForViewer } from 'lib/plugins/repository';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { reportError } from 'lib/observability/report';

export async function GET() {
  try {
    const { plugins, summary } = await listPluginRegistryWithSummary();
    // Operator-only plugins (e.g. Mutual Time) are hidden from non-admin viewers so the
    // user app launcher never lists them. Admins get the full registry.
    // A failed access read falls back to the member's list (no admin-only tiles), and is reported so
    // an admin who loses those tiles has a reason on record.
    const decision = await evaluatePluginAccess({ requireUsername: false }).catch((caught: unknown) => {
      reportError(caught, { area: 'plugins', op: 'index_admin_check' });
      return null;
    });
    const isAdmin = !!(decision && decision.allowed && decision.isAdmin);
    // Double gate for non-admin viewers: listPluginRegistryWithSummary already excludes hidden
    // plugins (DB WHERE clause or fallback filter), but this route must never depend on that
    // alone — an explicit isVisible check here keeps hidden plugins out even if the upstream
    // query or fallback changes. Admins keep the full list they were given.
    const adminFiltered = filterPluginsForViewer(plugins, isAdmin);
    const visiblePlugins = isAdmin ? adminFiltered : adminFiltered.filter((plugin) => plugin.isVisible);
    return NextResponse.json({ plugins: visiblePlugins, summary }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'plugins', op: 'index' });
    return NextResponse.json(
      {
        ok: false,
        code: 'plugin_registry_unavailable',
        message: 'Unable to load plugin registry.',
      },
      { status: 503 },
    );
  }
}
