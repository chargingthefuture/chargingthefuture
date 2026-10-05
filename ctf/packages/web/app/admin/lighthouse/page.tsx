import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import {
  getLighthouseAdminStats,
  listLighthouseMatchesAdmin,
  listLighthousePropertiesAdmin,
} from 'lib/lighthouse/repository';
import { listActiveCurrencies } from 'lib/currency/repository';
import { LighthouseAdminShell } from '@/components/lighthouse/lighthouse-admin-shell';

export const dynamic = 'force-dynamic';

export default async function LighthouseAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/lighthouse');
  }

  // The currency catalog is read with the listings so each rent is shown in its own currency: a
  // ServiceCredits rent by its label and a euro rent with its own symbol, never as a "$" figure.
  const [stats, properties, matches, currencies] = await Promise.all([
    getLighthouseAdminStats(),
    listLighthousePropertiesAdmin(),
    listLighthouseMatchesAdmin(),
    listActiveCurrencies(),
  ]);

  return <LighthouseAdminShell stats={stats} properties={properties} matches={matches} currencies={currencies} />;
}
