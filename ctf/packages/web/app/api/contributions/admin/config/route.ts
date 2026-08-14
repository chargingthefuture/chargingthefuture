import { NextResponse } from 'next/server';
import {
  auditBestEffort,
  contributionsErrorResponse,
  ensureMutationCsrf,
  parseJsonObject,
  requireContributionsAdminAccess,
} from '../../_lib';
import {
  getContributionsConfig,
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

const CONFIG_FIELDS = [
  'creditsPerUsd',
  'nonMonetaryUnitValueUsd',
  'perUserCycleCreditCap',
  'bannerSnoozeMonths',
  'bannerEnabled',
  'signalInstructions',
] as const satisfies readonly (keyof ConfigBody)[];

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

  const parsed = await parseJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  const body = parsed.body as ConfigBody;
  const changedKnobs = CONFIG_FIELDS.filter((field) => body[field] !== undefined);

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

    await auditBestEffort('admin_config_update', {
      actorUserId: gate.auth.userId,
      action: 'contributions.admin.config.update',
      metadata: {
        // Only the fields the caller actually sent — an omitted field keeps its current value,
        // so listing every knob here would misattribute untouched settings as changed.
        changedKnobs,
        resultingConfig: {
          creditsPerUsd: config.creditsPerUsd,
          nonMonetaryUnitValueUsd: config.nonMonetaryUnitValueUsd,
          perUserCycleCreditCap: config.perUserCycleCreditCap,
          bannerSnoozeMonths: config.bannerSnoozeMonths,
          bannerEnabled: config.bannerEnabled,
        },
      },
    });

    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return contributionsErrorResponse(error, 'Contribution settings update unavailable.', 'admin_config_update');
  }
}
