import { NextResponse } from 'next/server';
import { contributionsErrorResponse, requireContributionsUserAccess } from '../_lib';
import { getContributionsConfig, getFundraiserSnapshot } from 'lib/contributions/repository';

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
    return NextResponse.json({
      ok: true,
      fundraiser: snapshot,
      signalInstructions: config.signalInstructions,
    });
  } catch (error) {
    return contributionsErrorResponse(error, 'Fundraiser status unavailable.', 'fundraiser_get');
  }
}
