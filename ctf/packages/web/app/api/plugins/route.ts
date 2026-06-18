import { NextResponse } from 'next/server';
import { listPluginRegistryWithSummary, filterPluginsForViewer } from 'lib/plugins/repository';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { reportError } from 'lib/observability/report';

export async function GET() {
  try {
    const { plugins, summary } = await listPluginRegistryWithSummary();
    // Operator-only plugins (e.g. Weekly Performance) are hidden from non-admin viewers so the
    // user app launcher never lists them. Admins get the full registry.
    const decision = await evaluatePluginAccess({ requireUsername: false }).catch(() => null);
    const isAdmin = !!(decision && decision.allowed && decision.isAdmin);
    const visiblePlugins = filterPluginsForViewer(plugins, isAdmin);
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
