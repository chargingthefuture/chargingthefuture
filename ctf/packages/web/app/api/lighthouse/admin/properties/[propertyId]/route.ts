import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseAdminAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { insertLighthouseAudit, updateProperty, validatePropertyInput } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';
import type { LighthousePropertyInput } from 'lib/lighthouse/types';

type RouteParams = {
  params: Promise<{ propertyId: string }>;
};

type PropertyBody = Partial<LighthousePropertyInput>;

function parsePropertyInput(body: PropertyBody): LighthousePropertyInput {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    description: typeof body.description === 'string' ? body.description : '',
    propertyType: typeof body.propertyType === 'string' ? body.propertyType : null,
    addressLine: typeof body.addressLine === 'string' ? body.addressLine : null,
    city: typeof body.city === 'string' ? body.city : null,
    state: typeof body.state === 'string' ? body.state : null,
    country: typeof body.country === 'string' ? body.country : null,
    zipCode: typeof body.zipCode === 'string' ? body.zipCode : null,
    bedrooms: typeof body.bedrooms === 'number' ? body.bedrooms : null,
    bathrooms: typeof body.bathrooms === 'number' ? body.bathrooms : null,
    monthlyRent: typeof body.monthlyRent === 'number' ? body.monthlyRent : null,
    availableFromIso: typeof body.availableFromIso === 'string' ? body.availableFromIso : null,
    amenities: body.amenities,
    houseRules: body.houseRules,
    photos: body.photos,
    airbnbProfileUrl: typeof body.airbnbProfileUrl === 'string' ? body.airbnbProfileUrl : null,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
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
  } catch {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
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
    const code = error instanceof Error ? error.message : '';

    if (code === 'property_not_found') {
      return NextResponse.json(
        { ok: false, code: LIGHTHOUSE_ERROR_CODE.propertyNotFound, message: 'Lighthouse property not found.' },
        { status: 404 },
      );
    }

    reportError(error, { area: 'lighthouse', op: 'admin_property_update', extra: { userId: gate.auth.userId, propertyId } });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Admin property update unavailable.' },
      { status: 503 },
    );
  }
}
