import { NextResponse } from 'next/server';
import {
  contributionsErrorResponse,
  ensureMutationCsrf,
  requireContributionsAdminAccess,
} from '../../_lib';
import {
  getContributionsConfig,
  insertContributionsAudit,
  updateContributionsConfig,
} from 'lib/contributions/repository';

type ConfigBody = {
  creditsPerUsd?: number;
  nonMonetaryUnitValueUsd?: number;
  perUserCycleCreditCap?: number;
  bannerSnoozeMonths?: number;
  bannerEnabled?: boolean;
  signalInstructions?: string;
};

export async function GET() {
  const gate = await requireContributionsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const config = await getContributionsConfig();
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return contributionsErrorResponse(error, 'Contribution settings unavailable.', 'admin_config_get');
  }
}

export async function PUT(request: Request) {
  const gate = await requireContributionsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: ConfigBody;
  try {
    body = (await request.json()) as ConfigBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'contributions_invalid_payload', message: 'Invalid JSON payload.' }, { status: 400 });
  }

  try {
    const config = await updateContributionsConfig({
      actorUserId: gate.auth.userId,
      creditsPerUsd: body.creditsPerUsd,
      nonMonetaryUnitValueUsd: body.nonMonetaryUnitValueUsd,
      perUserCycleCreditCap: body.perUserCycleCreditCap,
      bannerSnoozeMonths: body.bannerSnoozeMonths,
      bannerEnabled: body.bannerEnabled,
      signalInstructions: body.signalInstructions,
    });

    await insertContributionsAudit({
      actorUserId: gate.auth.userId,
      action: 'contributions.admin.config.update',
      metadata: {
        creditsPerUsd: config.creditsPerUsd,
        nonMonetaryUnitValueUsd: config.nonMonetaryUnitValueUsd,
        perUserCycleCreditCap: config.perUserCycleCreditCap,
        bannerSnoozeMonths: config.bannerSnoozeMonths,
        bannerEnabled: config.bannerEnabled,
      },
    });

    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return contributionsErrorResponse(error, 'Contribution settings update unavailable.', 'admin_config_update');
  }
}
