import { isFeatureFlagBackendConfigured } from 'lib/feature-flags';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    {
      status: 'ok',
      featureFlags: isFeatureFlagBackendConfigured() ? 'configured' : 'defaults',
    },
    { status: 200 },
  );
}
