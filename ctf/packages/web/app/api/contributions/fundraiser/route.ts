import { NextResponse } from 'next/server';
import { contributionsErrorResponse, requireContributionsUserAccess } from '../_lib';
import { getContributionsConfig, getFundraiserSnapshot } from 'lib/contributions/repository';
import { getOwnerSignalUrl } from 'lib/contributions/owner-signal-env';

export async function GET() {
  const gate = await requireContributionsUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const snapshot = await getFundraiserSnapshot(gate.auth.userId);
    const config = await getContributionsConfig();

    // Only member-safe config copy is exposed (the Signal instructions shown after a gift-card
    // submission). Internal knobs such as the snooze length are never surfaced.
    //
    // ownerSignalUrl is read from a server-only env var (CONTRIBUTIONS_OWNER_SIGNAL_URL); it is
    // shown inline on the confirmation screen. When unset it is null and the UI falls back to the
    // editable signalInstructions copy. The value is never logged.
    // Resulting thank-you SC for one confirmed comment or star = USD-equivalent unit value ×
    // credits-per-dollar. Exposed so member copy matches the admin settings instead of a hardcoded
    // default.
    const creditsPerActionSc = Math.round(config.nonMonetaryUnitValueUsd * config.creditsPerUsd);

    return NextResponse.json({
      ok: true,
      fundraiser: snapshot,
      signalInstructions: config.signalInstructions,
      ownerSignalUrl: getOwnerSignalUrl(),
      creditsPerUsd: config.creditsPerUsd,
      creditsPerActionSc,
    });
  } catch (error) {
    return contributionsErrorResponse(error, 'Fundraiser status unavailable.', 'fundraiser_get');
  }
}
