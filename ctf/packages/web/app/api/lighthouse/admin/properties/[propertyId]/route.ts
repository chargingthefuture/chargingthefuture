import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseAdminAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { insertLighthouseAudit, updateProperty, validatePropertyInput } from 'lib/lighthouse/repository';
import type { LighthousePropertyInput } from 'lib/lighthouse/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteParams = {
  params: Promise<{ propertyId: string }>;
};

type PropertyBody = Partial<LighthousePropertyInput>;

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asStringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parsePropertyInput(body: PropertyBody): LighthousePropertyInput {
  return {
    title: asStringOr(body.title, ''),
    description: asStringOr(body.description, ''),
    propertyType: asString(body.propertyType),
    addressLine: asString(body.addressLine),
    city: asString(body.city),
    state: asString(body.state),
    country: asString(body.country),
    zipCode: asString(body.zipCode),
    bedrooms: asNumber(body.bedrooms),
    bathrooms: asNumber(body.bathrooms),
    monthlyRent: asNumber(body.monthlyRent),
    availableFromIso: asString(body.availableFromIso),
    amenities: body.amenities,
    houseRules: body.houseRules,
    photos: body.photos,
    airbnbProfileUrl: asString(body.airbnbProfileUrl),
    isActive: asBoolean(body.isActive, true),
  };
}

export async function PUT(request: Request, { params }: RouteParams) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: PropertyBody;
  try {
    body = (await request.json()) as PropertyBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const input = parsePropertyInput(body);
  if (!validatePropertyInput(input)) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid property payload.' },
      { status: 400 },
    );
  }

  const { propertyId } = await params;

  try {
    const property = await updateProperty(gate.auth.userId, propertyId, input, true);
    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.admin.property.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'property',
      targetId: property.id,
    });

    return NextResponse.json({ ok: true, property }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'admin_properties_propertyid' });
    const code = error instanceof Error ? error.message : '';

    if (code === 'property_not_found') {
      return NextResponse.json(
        { ok: false, code: LIGHTHOUSE_ERROR_CODE.propertyNotFound, message: `Lighthouse property not found: ${failureReason(error)}` },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Admin property update unavailable.' },
      { status: 503 },
    );
  }
}
