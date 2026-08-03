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

function asStringArray(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((code): code is string => typeof code === 'string')
    : null;
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
    rentCurrency: asString(body.rentCurrency),
    acceptedCurrencies: asStringArray(body.acceptedCurrencies),
    availableFromIso: asString(body.availableFromIso),
    amenities: body.amenities,
    houseRules: body.houseRules,
    photos: body.photos,
    airbnbProfileUrl: asString(body.airbnbProfileUrl),
    isActive: asBoolean(body.isActive, true),
  };
}

// Maps a repository error code (thrown as an Error message) to the exact status/body it produced
// before. Keeping this as a lookup table preserves each response 1:1 while avoiding a long if-chain.
const LIGHTHOUSE_ERROR_RESPONSES: Record<string, { code: string; message: string; status: number }> = {
  profile_not_found: { code: LIGHTHOUSE_ERROR_CODE.profileNotFound, message: 'Lighthouse profile not found.', status: 404 },
  property_not_found: { code: LIGHTHOUSE_ERROR_CODE.propertyNotFound, message: 'Lighthouse property not found.', status: 404 },
  match_not_found: { code: LIGHTHOUSE_ERROR_CODE.matchNotFound, message: 'Lighthouse match not found.', status: 404 },
  not_owner: { code: LIGHTHOUSE_ERROR_CODE.notOwner, message: 'Operation requires ownership.', status: 403 },
  policy_denied: { code: LIGHTHOUSE_ERROR_CODE.policyDenied, message: 'Operation denied by policy.', status: 403 },
  blocked_pair: { code: LIGHTHOUSE_ERROR_CODE.blockedPair, message: 'This listing is not available to you.', status: 403 },
  duplicate_match: { code: LIGHTHOUSE_ERROR_CODE.duplicateMatch, message: 'Active match request already exists.', status: 409 },
  'invalid payload': { code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid payload.', status: 400 },
};

function lighthouseErrorResponse(error: unknown, fallbackMessage: string) {
  const code = error instanceof Error ? error.message : '';
  const mapped = LIGHTHOUSE_ERROR_RESPONSES[code];
  if (mapped) {
    return NextResponse.json({ ok: false, code: mapped.code, message: mapped.message }, { status: mapped.status });
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
    // Pass the browsing member so listings from anyone they have blocked (or who blocked them) are
    // left out — a block hides the person as well as stopping contact.
    const result = await listProperties({ page, pageSize, country, city, onlyActive, viewerUserId: gate.auth.userId });
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
