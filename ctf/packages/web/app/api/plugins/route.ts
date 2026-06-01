import { NextResponse } from 'next/server';
import { listPluginRegistryWithSummary } from 'lib/plugins/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  try {
    const { plugins, summary } = await listPluginRegistryWithSummary();
    return NextResponse.json({ plugins, summary }, { status: 200 });
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
