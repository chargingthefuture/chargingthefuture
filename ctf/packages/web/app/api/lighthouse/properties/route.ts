import { NextRequest, NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import {
  createProperty,
  insertLighthouseAudit,
  listProperties,
  validatePropertyInput,
} from 'lib/lighthouse/repository';
import type { LighthousePropertyInput } from 'lib/lighthouse/types';
import { reportError } from 'lib/observability/report';

type PropertyBody = Partial<LighthousePropertyInput>;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOnlyActive(value: string | null): boolean {
  if (value === null) {
    return true;
  }

  return !(value === 'false' || value === '0');
}

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

function lighthouseErrorResponse(error: unknown, fallbackMessage: string) {
  const code = error instanceof Error ? error.message : '';

  if (code === 'profile_not_found') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.profileNotFound, message: 'Lighthouse profile not found.' },
      { status: 404 },
    );
  }

  if (code === 'property_not_found') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.propertyNotFound, message: 'Lighthouse property not found.' },
      { status: 404 },
    );
  }

  if (code === 'match_not_found') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.matchNotFound, message: 'Lighthouse match not found.' },
      { status: 404 },
    );
  }

  if (code === 'block_not_found') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.blockNotFound, message: 'Lighthouse block not found.' },
      { status: 404 },
    );
  }

  if (code === 'not_owner') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.notOwner, message: 'Operation requires ownership.' },
      { status: 403 },
    );
  }

  if (code === 'policy_denied') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.policyDenied, message: 'Operation denied by policy.' },
      { status: 403 },
    );
  }

  if (code === 'blocked_pair') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.blockedPair, message: 'Match blocked by pair policy.' },
      { status: 403 },
    );
  }

  if (code === 'self_block') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.selfBlock, message: 'Cannot block your own user account.' },
      { status: 403 },
    );
  }

  if (code === 'duplicate_match') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.duplicateMatch, message: 'Active match request already exists.' },
      { status: 409 },
    );
  }

  if (code === 'invalid payload') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid payload.' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: fallbackMessage },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
  const pageSize = parsePositiveInt(request.nextUrl.searchParams.get('pageSize'), 20);
  const country = request.nextUrl.searchParams.get('country') ?? undefined;
  const city = request.nextUrl.searchParams.get('city') ?? undefined;
  const onlyActive = parseOnlyActive(request.nextUrl.searchParams.get('onlyActive'));

  try {
    const result = await listProperties({ page, pageSize, country, city, onlyActive });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'properties' });
    return lighthouseErrorResponse(error, 'Property listing unavailable.');
  }
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseReadAccess();
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

  try {
    const property = await createProperty(gate.auth.userId, input);
    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.property.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'property',
      targetId: property.id,
    });

    return NextResponse.json({ ok: true, property }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'properties' });
    return lighthouseErrorResponse(error, 'Property create unavailable.');
  }
}
