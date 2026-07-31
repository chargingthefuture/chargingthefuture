import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  LIGHTHOUSE_DEFAULT_PAGE,
  LIGHTHOUSE_DEFAULT_PAGE_SIZE,
  LIGHTHOUSE_MATCH_STATUSES,
  LIGHTHOUSE_MAX_PAGE_SIZE,
  LIGHTHOUSE_PROFILE_TYPES,
} from './constants';
import type {
  LighthouseBlock,
  LighthouseMatch,
  LighthouseMatchCreateInput,
  LighthouseMatchUpdateInput,
  LighthouseProfile,
  LighthouseProfileInput,
  LighthouseProfileType,
  LighthouseProperty,
  LighthousePropertyInput,
} from './types';
import { createLighthouseParticipantToken, ensureLighthouseMatchChannel } from './stream';
import { clearMemberPresence, recordMemberPresence } from 'lib/presence/live';

// Cross-plugin presence: a LightHouse property listing marks its host as active in LightHouse.
const LIGHTHOUSE_PRESENCE_SLUG = 'lighthouse';
const LIGHTHOUSE_PRESENCE_REF_TYPE = 'property';
const LIGHTHOUSE_PRESENCE_LABEL = 'Housing listing';
const LIGHTHOUSE_PRESENCE_DEEP_LINK = '/apps/lighthouse';

type CountRow = { total: string };

type LighthouseProfileRow = {
  id: string;
  user_id: string;
  profile_type: LighthouseProfileType;
  bio: string | null;
  phone_number: string | null;
  signal_url: string | null;
  is_active: boolean;
  has_property: boolean;
  housing_needs: string | null;
  desired_move_in_date: Date | string | null;
  budget_min: number | string | null;
  budget_max: number | string | null;
  desired_country: string | null;
  updated_at: Date | string;
};

type LighthousePropertyRow = {
  id: string;
  host_user_id: string;
  title: string;
  description: string;
  property_type: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  bedrooms: number | null;
  bathrooms: number | string | null;
  monthly_rent: number | string | null;
  rent_currency: string | null;
  available_from: Date | string | null;
  amenities: unknown;
  house_rules: unknown;
  photos: unknown;
  airbnb_profile_url: string | null;
  is_active: boolean;
  updated_at: Date | string;
};

type LighthouseMatchRow = {
  id: string;
  property_id: string;
  seeker_user_id: string;
  host_user_id: string;
  message: string | null;
  proposed_move_in_date: Date | string | null;
  host_response: string | null;
  status: LighthouseMatch['status'];
  created_at: Date | string;
  updated_at: Date | string;
  stream_channel_id: string;
};

type LighthouseBlockRow = {
  id: string;
  blocker_user_id: string;
  blocked_user_id: string;
  reason: string | null;
  created_at: Date | string;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => normalizeText(item))
    .filter((item) => item.length > 0);

  return Array.from(new Set(normalized));
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseJsonArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value;
}

function normalizePage(inputPage: number | undefined, inputPageSize: number | undefined): { page: number; pageSize: number; offset: number } {
  const page = Number.isInteger(inputPage) && Number(inputPage) > 0 ? Number(inputPage) : LIGHTHOUSE_DEFAULT_PAGE;
  const pageSize = Number.isInteger(inputPageSize)
    ? Math.min(LIGHTHOUSE_MAX_PAGE_SIZE, Math.max(1, Number(inputPageSize)))
    : LIGHTHOUSE_DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function parseCountRow(rows: CountRow[]): number {
  return Number.parseInt(rows[0]?.total ?? '0', 10);
}

function parseNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidIsoDatetime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function mapProfile(row: LighthouseProfileRow): LighthouseProfile {
  return {
    id: row.id,
    userId: row.user_id,
    profileType: row.profile_type,
    bio: row.bio,
    phoneNumber: row.phone_number,
    signalUrl: row.signal_url,
    isActive: row.is_active,
    hasProperty: row.has_property,
    housingNeeds: row.housing_needs,
    desiredMoveInDateIso: row.desired_move_in_date ? toIso(row.desired_move_in_date) : null,
    budgetMin: parseNullableNumber(row.budget_min),
    budgetMax: parseNullableNumber(row.budget_max),
    desiredCountry: row.desired_country,
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapProperty(row: LighthousePropertyRow): LighthouseProperty {
  return {
    id: row.id,
    hostUserId: row.host_user_id,
    title: row.title,
    description: row.description,
    propertyType: row.property_type,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    country: row.country,
    zipCode: row.zip_code,
    bedrooms: row.bedrooms,
    bathrooms: parseNullableNumber(row.bathrooms),
    monthlyRent: parseNullableNumber(row.monthly_rent),
    rentCurrency: row.rent_currency,
    // The accepted-currencies set and the ServiceCredits flag are loaded separately (per the join
    // table) by attachAcceptedCurrencies; mapProperty stays pure and defaults them to empty here.
    acceptedCurrencies: [],
    acceptsServiceCredits: false,
    availableFromIso: row.available_from ? toIso(row.available_from) : null,
    amenities: normalizeStringArray(parseJsonArray(row.amenities)),
    houseRules: normalizeStringArray(parseJsonArray(row.house_rules)),
    photos: normalizeStringArray(parseJsonArray(row.photos)),
    airbnbProfileUrl: row.airbnb_profile_url,
    isActive: row.is_active,
    updatedAtIso: toIso(row.updated_at),
  };
}

type AcceptedCurrencyRow = { property_id: string; currency_code: string; is_service_credits: boolean };

const ACCEPTED_CURRENCIES_SQL = `
  SELECT pac.property_id::text AS property_id, pac.currency_code, c.is_service_credits
  FROM lighthouse_property_accepted_currencies pac
  JOIN currencies c ON c.code = pac.currency_code
  WHERE pac.property_id = ANY($1::uuid[])
`;

// Load each property's accepted currencies from lighthouse_property_accepted_currencies and attach
// them to the mapped properties. acceptsServiceCredits is computed by joining the accepted codes
// against currencies.is_service_credits — never derived from the rent currency. Best-effort: any
// failure leaves the (empty) defaults so a listing still renders without currency annotations.
async function attachAcceptedCurrencies(properties: LighthouseProperty[]): Promise<LighthouseProperty[]> {
  const propertyIds = properties.map((property) => property.id);
  if (propertyIds.length === 0) {
    return properties;
  }

  const result = await queryDb<AcceptedCurrencyRow>(ACCEPTED_CURRENCIES_SQL, [propertyIds]);
  return mergeAcceptedCurrencies(properties, result.rows);
}

// Same as attachAcceptedCurrencies but reads on a transaction client so freshly inserted rows are
// visible inside createProperty/updateProperty.
async function attachAcceptedCurrenciesWithClient(
  client: PoolClient,
  properties: LighthouseProperty[],
): Promise<LighthouseProperty[]> {
  const propertyIds = properties.map((property) => property.id);
  if (propertyIds.length === 0) {
    return properties;
  }

  const result = await client.query<AcceptedCurrencyRow>(ACCEPTED_CURRENCIES_SQL, [propertyIds]);
  return mergeAcceptedCurrencies(properties, result.rows);
}

function mergeAcceptedCurrencies(properties: LighthouseProperty[], rows: AcceptedCurrencyRow[]): LighthouseProperty[] {
  const codesByProperty = new Map<string, string[]>();
  const serviceCreditsByProperty = new Map<string, boolean>();
  for (const row of rows) {
    const codes = codesByProperty.get(row.property_id) ?? [];
    codes.push(row.currency_code);
    codesByProperty.set(row.property_id, codes);
    if (row.is_service_credits) {
      serviceCreditsByProperty.set(row.property_id, true);
    }
  }

  return properties.map((property) => ({
    ...property,
    acceptedCurrencies: codesByProperty.get(property.id) ?? [],
    acceptsServiceCredits: serviceCreditsByProperty.get(property.id) ?? false,
  }));
}

// Validate the requested accepted-currency codes against the active currencies catalog and persist
// them for a property. Caller is responsible for clearing existing rows first (REPLACE semantics on
// update). Unknown or inactive codes are skipped. Runs inside the caller's transaction.
async function replaceAcceptedCurrencies(client: PoolClient, propertyId: string, codes: string[]): Promise<void> {
  const requested = Array.from(
    new Set(codes.filter((code): code is string => typeof code === 'string' && code.trim().length > 0).map((code) => code.trim())),
  );
  if (requested.length === 0) {
    return;
  }

  const valid = await client.query<{ code: string }>(
    `SELECT code FROM currencies WHERE code = ANY($1::text[]) AND is_active = TRUE`,
    [requested],
  );
  const validCodes = valid.rows.map((row) => row.code);
  for (const code of validCodes) {
    await client.query(
      `
        INSERT INTO lighthouse_property_accepted_currencies (property_id, currency_code)
        VALUES ($1::uuid, $2)
        ON CONFLICT (property_id, currency_code) DO NOTHING
      `,
      [propertyId, code],
    );
  }
}

function mapMatch(row: LighthouseMatchRow): LighthouseMatch {
  return {
    id: row.id,
    propertyId: row.property_id,
    seekerUserId: row.seeker_user_id,
    hostUserId: row.host_user_id,
    message: row.message,
    proposedMoveInDateIso: row.proposed_move_in_date ? toIso(row.proposed_move_in_date) : null,
    hostResponse: row.host_response,
    status: row.status,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
    streamChannelId: row.stream_channel_id,
  };
}

function mapBlock(row: LighthouseBlockRow): LighthouseBlock {
  return {
    id: row.id,
    blockerUserId: row.blocker_user_id,
    blockedUserId: row.blocked_user_id,
    reason: row.reason,
    createdAtIso: toIso(row.created_at),
  };
}

// A budget value is valid when it is absent (null) or a finite, non-negative number.
function isNonNegativeFiniteOrNull(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0);
}

// Validate a budget min/max pair: each side must be non-negative-or-null, and when both are present
// the max must not be below the min.
function isBudgetPairValid(min: number | null, max: number | null): boolean {
  const minValid = isNonNegativeFiniteOrNull(min);
  const maxValid = isNonNegativeFiniteOrNull(max);
  const rangeValid = min === null || max === null || max >= min;
  return minValid && maxValid && rangeValid;
}

// An optional numeric property field is valid when it is undefined/null or a finite, non-negative
// number.
function isOptionalNonNegativeNumber(value: number | null | undefined): boolean {
  return value === undefined || value === null || (Number.isFinite(value) && value >= 0);
}

export function validateProfileInput(input: LighthouseProfileInput): boolean {
  const profileTypeAllowed = LIGHTHOUSE_PROFILE_TYPES.includes(input.profileType);
  const moveInDate = normalizeNullableText(input.desiredMoveInDateIso);
  const moveInDateAllowed = !moveInDate || isValidIsoDatetime(moveInDate);

  const budgetValid = isBudgetPairValid(input.budgetMin ?? null, input.budgetMax ?? null);

  return profileTypeAllowed && moveInDateAllowed && budgetValid;
}

export function validatePropertyInput(input: LighthousePropertyInput): boolean {
  const title = normalizeText(input.title ?? '');
  const description = normalizeText(input.description ?? '');
  const bedroomsValid = isOptionalNonNegativeNumber(input.bedrooms);
  const bathroomsValid = isOptionalNonNegativeNumber(input.bathrooms);
  const monthlyRentValid = isOptionalNonNegativeNumber(input.monthlyRent);

  return title.length > 0 && description.length > 0 && bedroomsValid && bathroomsValid && monthlyRentValid;
}

export function validateMatchCreateInput(input: LighthouseMatchCreateInput): boolean {
  return normalizeText(input.propertyId ?? '').length > 0;
}

export function validateMatchUpdateInput(input: LighthouseMatchUpdateInput): boolean {
  return LIGHTHOUSE_MATCH_STATUSES.includes(input.status);
}

export async function getProfile(userId: string): Promise<LighthouseProfile | null> {
  const result = await queryDb<LighthouseProfileRow>(
    `
      SELECT
        id,
        user_id,
        profile_type,
        bio,
        phone_number,
        signal_url,
        is_active,
        has_property,
        housing_needs,
        desired_move_in_date,
        budget_min,
        budget_max,
        desired_country,
        updated_at
      FROM lighthouse_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ? mapProfile(result.rows[0]) : null;
}

export async function upsertProfile(actorUserId: string, input: LighthouseProfileInput, isAdmin: boolean): Promise<LighthouseProfile> {
  return withDbTransaction(async (client: PoolClient) => {
    const existing = await client.query(
      `
        SELECT profile_type
        FROM lighthouse_profiles
        WHERE user_id = $1
        LIMIT 1
      `,
      [actorUserId],
    );

    // A member can be both a host and a seeker (owner decision). The profile row is no longer locked
    // to a single type: for a non-admin with an existing row we KEEP their current profile_type
    // rather than flipping it (so saving seeker details on a host account does not relabel or
    // un-host them), while a brand-new profile takes the incoming type. Admins may still set the
    // type explicitly. `has_property` is sticky-true (below) so filling the seeker form never clears
    // a member's host flag.
    const effectiveType =
      !isAdmin && existing.rows[0] ? existing.rows[0].profile_type : input.profileType;

    const upserted = await client.query(
      `
        INSERT INTO lighthouse_profiles
          (user_id, profile_type, bio, phone_number, signal_url, is_active, has_property, housing_needs, desired_move_in_date, budget_min, budget_max, desired_country, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11, $12, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          profile_type = EXCLUDED.profile_type,
          bio = EXCLUDED.bio,
          phone_number = EXCLUDED.phone_number,
          signal_url = EXCLUDED.signal_url,
          is_active = EXCLUDED.is_active,
          has_property = lighthouse_profiles.has_property OR EXCLUDED.has_property,
          housing_needs = EXCLUDED.housing_needs,
          desired_move_in_date = EXCLUDED.desired_move_in_date,
          budget_min = EXCLUDED.budget_min,
          budget_max = EXCLUDED.budget_max,
          desired_country = EXCLUDED.desired_country,
          service_deleted_at = NULL,
          updated_at = NOW()
        RETURNING
          id,
          user_id,
          profile_type,
          bio,
          phone_number,
          signal_url,
          is_active,
          has_property,
          housing_needs,
          desired_move_in_date,
          budget_min,
          budget_max,
          desired_country,
          updated_at
      `,
      [
        actorUserId,
        effectiveType,
        normalizeNullableText(input.bio),
        normalizeNullableText(input.phoneNumber),
        normalizeNullableText(input.signalUrl),
        typeof input.isActive === 'boolean' ? input.isActive : true,
        typeof input.hasProperty === 'boolean' ? input.hasProperty : false,
        normalizeNullableText(input.housingNeeds),
        normalizeNullableText(input.desiredMoveInDateIso),
        input.budgetMin ?? null,
        input.budgetMax ?? null,
        normalizeNullableText(input.desiredCountry),
      ],
    );

    return mapProfile(upserted.rows[0]);
  });
}

export async function deleteProfile(userId: string): Promise<void> {
  await withDbTransaction(async (client: PoolClient) => {
    await client.query(
      `
        INSERT INTO lighthouse_user_extension (user_id, service_deleted_at, updated_at)
        VALUES ($1, NOW(), NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          service_deleted_at = NOW(),
          updated_at = NOW()
      `,
      [userId],
    );

    await client.query('DELETE FROM lighthouse_profiles WHERE user_id = $1', [userId]);
  });
}

export async function listProperties(input: {
  page?: number;
  pageSize?: number;
  country?: string;
  city?: string;
  onlyActive?: boolean;
}): Promise<{ items: LighthouseProperty[]; total: number; pagination: { page: number; pageSize: number } }> {
  const paging = normalizePage(input.page, input.pageSize);
  const country = normalizeNullableText(input.country);
  const city = normalizeNullableText(input.city);
  const onlyActive = input.onlyActive !== false;

  const [countResult, rows] = await Promise.all([
    queryDb<CountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM lighthouse_properties
        WHERE ($1::boolean = FALSE OR is_active = TRUE)
          AND ($2::text IS NULL OR country = $2)
          AND ($3::text IS NULL OR city = $3)
      `,
      [onlyActive, country, city],
    ),
    queryDb<LighthousePropertyRow>(
      `
        SELECT
          id,
          host_user_id,
          title,
          description,
          property_type,
          address_line,
          city,
          state,
          country,
          zip_code,
          bedrooms,
          bathrooms,
          monthly_rent,
          rent_currency,
          available_from,
          amenities,
          house_rules,
          photos,
          airbnb_profile_url,
          is_active,
          updated_at
        FROM lighthouse_properties
        WHERE ($1::boolean = FALSE OR is_active = TRUE)
          AND ($2::text IS NULL OR country = $2)
          AND ($3::text IS NULL OR city = $3)
        ORDER BY updated_at DESC
        OFFSET $4 LIMIT $5
      `,
      [onlyActive, country, city, paging.offset, paging.pageSize],
    ),
  ]);

  return {
    items: await attachAcceptedCurrencies(rows.rows.map(mapProperty)),
    total: parseCountRow(countResult.rows),
    pagination: {
      page: paging.page,
      pageSize: paging.pageSize,
    },
  };
}

export async function getPropertyById(propertyId: string): Promise<LighthouseProperty | null> {
  const result = await queryDb<LighthousePropertyRow>(
    `
      SELECT
        id,
        host_user_id,
        title,
        description,
        property_type,
        address_line,
        city,
        state,
        country,
        zip_code,
        bedrooms,
        bathrooms,
        monthly_rent,
        rent_currency,
        available_from,
        amenities,
        house_rules,
        photos,
        airbnb_profile_url,
        is_active,
        updated_at
      FROM lighthouse_properties
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [propertyId],
  );

  if (!result.rows[0]) {
    return null;
  }
  const [property] = await attachAcceptedCurrencies([mapProperty(result.rows[0])]);
  return property;
}

export async function listMyProperties(userId: string): Promise<LighthouseProperty[]> {
  const result = await queryDb<LighthousePropertyRow>(
    `
      SELECT
        id,
        host_user_id,
        title,
        description,
        property_type,
        address_line,
        city,
        state,
        country,
        zip_code,
        bedrooms,
        bathrooms,
        monthly_rent,
        rent_currency,
        available_from,
        amenities,
        house_rules,
        photos,
        airbnb_profile_url,
        is_active,
        updated_at
      FROM lighthouse_properties
      WHERE host_user_id = $1
      ORDER BY updated_at DESC
    `,
    [userId],
  );

  return attachAcceptedCurrencies(result.rows.map(mapProperty));
}

// Quora profile URL for a member, read from their Unlock verification submission (the single place
// a member's Quora link is captured; one row per user_id). Best-effort: any failure yields null so
// the self-hosting header simply omits the Quora link. Self-service hosting (2026-06-18).
export async function getHostQuoraUrl(userId: string): Promise<string | null> {
  try {
    const result = await queryDb<{ quora_profile_url: string | null }>(
      `
        SELECT quora_profile_url
        FROM unlock_verification_submissions
        WHERE user_id = $1 AND quora_profile_url IS NOT NULL AND quora_profile_url <> ''
        LIMIT 1
      `,
      [userId],
    );
    return result.rows[0]?.quora_profile_url ?? null;
  } catch {
    return null;
  }
}

export async function createProperty(actorUserId: string, input: LighthousePropertyInput): Promise<LighthouseProperty> {
  const property = await withDbTransaction(async (client: PoolClient) => {
    // Member self-service hosting (owner decision, 2026-06-18): any member may list their own
    // place — listing IS what makes them a host. We no longer hard-deny when there's no host
    // profile; instead we transparently provision one so the member never has to fill a separate
    // "host profile" form. ON CONFLICT keeps an existing profile row intact (a seeker who lists a
    // place stays a seeker row but is flagged has_property = TRUE) and never trips the user_id
    // unique constraint. The listing's host identity is composed from existing data
    // (name / username / Quora / trust), not from this row.
    await client.query(
      `
        INSERT INTO lighthouse_profiles (user_id, profile_type, is_active, has_property, updated_at)
        VALUES ($1, 'host', TRUE, TRUE, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET has_property = TRUE, updated_at = NOW()
      `,
      [actorUserId],
    );

    const created = await client.query(
      `
        INSERT INTO lighthouse_properties
          (host_user_id, title, description, property_type, address_line, city, state, country, zip_code, bedrooms, bathrooms, monthly_rent, available_from, amenities, house_rules, photos, airbnb_profile_url, is_active, rent_currency, created_by_user_id, updated_by_user_id)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::date, $14::jsonb, $15::jsonb, $16::jsonb, $17, $18, $19, $1, $1)
        RETURNING
          id,
          host_user_id,
          title,
          description,
          property_type,
          address_line,
          city,
          state,
          country,
          zip_code,
          bedrooms,
          bathrooms,
          monthly_rent,
          rent_currency,
          available_from,
          amenities,
          house_rules,
          photos,
          airbnb_profile_url,
          is_active,
          updated_at
      `,
      [
        actorUserId,
        normalizeText(input.title),
        normalizeText(input.description),
        normalizeNullableText(input.propertyType),
        normalizeNullableText(input.addressLine),
        normalizeNullableText(input.city),
        normalizeNullableText(input.state),
        normalizeNullableText(input.country),
        normalizeNullableText(input.zipCode),
        input.bedrooms ?? null,
        input.bathrooms ?? null,
        input.monthlyRent ?? null,
        normalizeNullableText(input.availableFromIso),
        JSON.stringify(normalizeStringArray(parseJsonArray(input.amenities))),
        JSON.stringify(normalizeStringArray(parseJsonArray(input.houseRules))),
        JSON.stringify(normalizeStringArray(parseJsonArray(input.photos))),
        normalizeNullableText(input.airbnbProfileUrl),
        typeof input.isActive === 'boolean' ? input.isActive : true,
        input.rentCurrency ?? null,
      ],
    );

    const propertyId = created.rows[0].id as string;
    await replaceAcceptedCurrencies(client, propertyId, Array.isArray(input.acceptedCurrencies) ? input.acceptedCurrencies : []);

    const [property] = await attachAcceptedCurrenciesWithClient(client, [mapProperty(created.rows[0])]);
    return property;
  });

  // Best-effort presence write after the listing is durably committed. A new active listing makes the
  // host active in LightHouse; an inactive listing is recorded as not-present. Never breaks create.
  if (property.isActive) {
    await recordMemberPresence({
      userId: property.hostUserId,
      pluginSlug: LIGHTHOUSE_PRESENCE_SLUG,
      refType: LIGHTHOUSE_PRESENCE_REF_TYPE,
      refId: property.id,
      label: LIGHTHOUSE_PRESENCE_LABEL,
      deepLink: LIGHTHOUSE_PRESENCE_DEEP_LINK,
    });
  } else {
    await clearMemberPresence({
      userId: property.hostUserId,
      pluginSlug: LIGHTHOUSE_PRESENCE_SLUG,
      refType: LIGHTHOUSE_PRESENCE_REF_TYPE,
      refId: property.id,
    });
  }

  return property;
}

export async function updateProperty(actorUserId: string, propertyId: string, input: LighthousePropertyInput, isAdmin: boolean): Promise<LighthouseProperty> {
  const property = await withDbTransaction(async (client: PoolClient) => {
    const existing = await client.query(
      `
        SELECT host_user_id
        FROM lighthouse_properties
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [propertyId],
    );

    if (existing.rows.length === 0) {
      throw new Error('property_not_found');
    }

    if (!isAdmin && existing.rows[0].host_user_id !== actorUserId) {
      throw new Error('not_owner');
    }

    const updated = await client.query(
      `
        UPDATE lighthouse_properties
        SET
          title = $2,
          description = $3,
          property_type = $4,
          address_line = $5,
          city = $6,
          state = $7,
          country = $8,
          zip_code = $9,
          bedrooms = $10,
          bathrooms = $11,
          monthly_rent = $12,
          available_from = $13::date,
          amenities = $14::jsonb,
          house_rules = $15::jsonb,
          photos = $16::jsonb,
          airbnb_profile_url = $17,
          is_active = $18,
          updated_by_user_id = $19,
          rent_currency = $20,
          updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING
          id,
          host_user_id,
          title,
          description,
          property_type,
          address_line,
          city,
          state,
          country,
          zip_code,
          bedrooms,
          bathrooms,
          monthly_rent,
          rent_currency,
          available_from,
          amenities,
          house_rules,
          photos,
          airbnb_profile_url,
          is_active,
          updated_at
      `,
      [
        propertyId,
        normalizeText(input.title),
        normalizeText(input.description),
        normalizeNullableText(input.propertyType),
        normalizeNullableText(input.addressLine),
        normalizeNullableText(input.city),
        normalizeNullableText(input.state),
        normalizeNullableText(input.country),
        normalizeNullableText(input.zipCode),
        input.bedrooms ?? null,
        input.bathrooms ?? null,
        input.monthlyRent ?? null,
        normalizeNullableText(input.availableFromIso),
        JSON.stringify(normalizeStringArray(parseJsonArray(input.amenities))),
        JSON.stringify(normalizeStringArray(parseJsonArray(input.houseRules))),
        JSON.stringify(normalizeStringArray(parseJsonArray(input.photos))),
        normalizeNullableText(input.airbnbProfileUrl),
        typeof input.isActive === 'boolean' ? input.isActive : true,
        actorUserId,
        input.rentCurrency ?? null,
      ],
    );

    // Replace the accepted-currencies set: clear existing rows, then insert the validated new set.
    await client.query('DELETE FROM lighthouse_property_accepted_currencies WHERE property_id = $1::uuid', [propertyId]);
    await replaceAcceptedCurrencies(client, propertyId, Array.isArray(input.acceptedCurrencies) ? input.acceptedCurrencies : []);

    const [property] = await attachAcceptedCurrenciesWithClient(client, [mapProperty(updated.rows[0])]);
    return property;
  });

  // Best-effort presence write after the listing is durably committed. An update may toggle the
  // listing's active flag, so re-record presence when active or clear it when the host marked it
  // inactive/closed. Never breaks update.
  if (property.isActive) {
    await recordMemberPresence({
      userId: property.hostUserId,
      pluginSlug: LIGHTHOUSE_PRESENCE_SLUG,
      refType: LIGHTHOUSE_PRESENCE_REF_TYPE,
      refId: property.id,
      label: LIGHTHOUSE_PRESENCE_LABEL,
      deepLink: LIGHTHOUSE_PRESENCE_DEEP_LINK,
    });
  } else {
    await clearMemberPresence({
      userId: property.hostUserId,
      pluginSlug: LIGHTHOUSE_PRESENCE_SLUG,
      refType: LIGHTHOUSE_PRESENCE_REF_TYPE,
      refId: property.id,
    });
  }

  return property;
}

export async function deleteProperty(actorUserId: string, propertyId: string, isAdmin: boolean): Promise<boolean> {
  const result = await withDbTransaction(async (client: PoolClient) => {
    const existing = await client.query(
      `
        SELECT host_user_id
        FROM lighthouse_properties
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [propertyId],
    );

    if (existing.rows.length === 0) {
      return { deleted: false, hostUserId: null as string | null };
    }

    if (!isAdmin && existing.rows[0].host_user_id !== actorUserId) {
      throw new Error('not_owner');
    }

    const hostUserId = existing.rows[0].host_user_id as string | null;
    const deleted = await client.query('DELETE FROM lighthouse_properties WHERE id = $1::uuid', [propertyId]);
    return { deleted: (deleted.rowCount ?? 0) > 0, hostUserId };
  });

  // Best-effort presence clear after the listing row is durably removed. Never breaks delete.
  if (result.deleted && result.hostUserId) {
    await clearMemberPresence({
      userId: result.hostUserId,
      pluginSlug: LIGHTHOUSE_PRESENCE_SLUG,
      refType: LIGHTHOUSE_PRESENCE_REF_TYPE,
      refId: propertyId,
    });
  }

  return result.deleted;
}

export async function isBlockedPair(userA: string, userB: string): Promise<boolean> {
  const result = await queryDb<{ found: number }>(
    `
      SELECT 1 AS found
      FROM lighthouse_blocks
      WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
         OR (blocker_user_id = $2 AND blocked_user_id = $1)
      LIMIT 1
    `,
    [userA, userB],
  );

  return result.rows.length > 0;
}

// Flatten a participant-token result into the three Stream fields returned to the caller, defaulting
// each to null when no token was issued.
function buildStreamTokenFields(
  token: Awaited<ReturnType<typeof createLighthouseParticipantToken>>,
): { streamApiKey: string | null; streamUserId: string | null; streamToken: string | null } {
  return {
    streamApiKey: token?.streamApiKey ?? null,
    streamUserId: token?.streamUserId ?? null,
    streamToken: token?.streamToken ?? null,
  };
}

export async function createMatchRequest(input: {
  actorUserId: string;
  actorDisplayName: string;
  propertyId: string;
  message?: string | null;
  desiredMoveInDateIso?: string | null;
  idempotencyKey: string;
}): Promise<{ match: LighthouseMatch; streamApiKey: string | null; streamUserId: string | null; streamToken: string | null }> {
  return withDbTransaction(async (client: PoolClient) => {
    void input.idempotencyKey;

    // A member can be both a host and a seeker (owner decision). Requesting a stay only needs an
    // active LightHouse profile — it is NOT gated on profile_type = 'seeker', so a member who has
    // listed a place (a host) can still request stays. Filling the seeker "Your details" form (which
    // creates/keeps an active profile) is what points members here.
    const requester = await client.query(
      `
        SELECT id
        FROM lighthouse_profiles
        WHERE user_id = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [input.actorUserId],
    );

    if (requester.rows.length === 0) {
      throw new Error('policy_denied');
    }

    const property = await client.query(
      `
        SELECT id::text AS id, host_user_id
        FROM lighthouse_properties
        WHERE id = $1::uuid
          AND is_active = TRUE
        LIMIT 1
      `,
      [input.propertyId],
    );

    if (property.rows.length === 0) {
      throw new Error('property_not_found');
    }

    const hostUserId = property.rows[0].host_user_id;

    // A member cannot request a stay on their own listing (the UI hides the button on an owned
    // listing; this is the server-side backstop now that hosts can also request).
    if (hostUserId === input.actorUserId) {
      throw new Error('policy_denied');
    }

    const blocked = await client.query(
      `
        SELECT 1 AS found
        FROM lighthouse_blocks
        WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
           OR (blocker_user_id = $2 AND blocked_user_id = $1)
        LIMIT 1
      `,
      [input.actorUserId, hostUserId],
    );

    if (blocked.rows.length > 0) {
      throw new Error('blocked_pair');
    }

    const duplicate = await client.query(
      `
        SELECT id::text AS id
        FROM lighthouse_matches
        WHERE property_id = $1
          AND seeker_user_id = $2
          AND status IN ('pending', 'accepted')
        LIMIT 1
      `,
      [input.propertyId, input.actorUserId],
    );

    if (duplicate.rows.length > 0) {
      throw new Error('duplicate_match');
    }

    // Generate the match id up front so the Stream channel can be provisioned before the row is
    // inserted. This avoids the old two-step INSERT('pending') + UPDATE pattern, which could leave a
    // committed row holding the literal placeholder 'pending' if the UPDATE failed, and could attempt
    // a duplicate channel creation on a transaction retry. The channel id is now written in the single
    // INSERT, so a committed match always carries its real channel id.
    const matchId = randomUUID();
    const fallbackChannelId = `lighthouse-match-${matchId}`;
    const seekerDisplayName = normalizeText(input.actorDisplayName || input.actorUserId);
    const ensuredChannelId = await ensureLighthouseMatchChannel({
      matchId,
      seekerUserId: input.actorUserId,
      seekerDisplayName,
      hostUserId,
      hostDisplayName: hostUserId,
    });
    const streamChannelId = ensuredChannelId ?? fallbackChannelId;

    const created = await client.query(
      `
        INSERT INTO lighthouse_matches
          (id, property_id, seeker_user_id, host_user_id, message, proposed_move_in_date, status, stream_channel_id)
        VALUES
          ($1::uuid, $2, $3, $4, $5, $6::date, 'pending', $7)
        RETURNING
          id,
          property_id,
          seeker_user_id,
          host_user_id,
          message,
          proposed_move_in_date,
          host_response,
          status,
          created_at,
          updated_at,
          stream_channel_id
      `,
      [
        matchId,
        input.propertyId,
        input.actorUserId,
        hostUserId,
        normalizeNullableText(input.message),
        normalizeNullableText(input.desiredMoveInDateIso),
        streamChannelId,
      ],
    );

    const token = await createLighthouseParticipantToken(input.actorUserId, seekerDisplayName);

    return {
      match: mapMatch(created.rows[0]),
      ...buildStreamTokenFields(token),
    };
  });
}

export async function listMatches(actorUserId: string): Promise<LighthouseMatch[]> {
  const result = await queryDb<LighthouseMatchRow>(
    `
      SELECT
        id,
        property_id,
        seeker_user_id,
        host_user_id,
        message,
        proposed_move_in_date,
        host_response,
        status,
        created_at,
        updated_at,
        stream_channel_id
      FROM lighthouse_matches
      WHERE seeker_user_id = $1 OR host_user_id = $1
      ORDER BY updated_at DESC
    `,
    [actorUserId],
  );

  return result.rows.map(mapMatch);
}

export async function updateMatch(input: {
  actorUserId: string;
  matchId: string;
  status: LighthouseMatch['status'];
  hostResponse?: string | null;
  isAdmin: boolean;
}): Promise<LighthouseMatch> {
  return withDbTransaction(async (client: PoolClient) => {
    const existing = await (client as PoolClient).query<LighthouseMatchRow>(
      `
        SELECT
          id,
          property_id,
          seeker_user_id,
          host_user_id,
          message,
          proposed_move_in_date,
          host_response,
          status,
          created_at,
          updated_at,
          stream_channel_id
        FROM lighthouse_matches
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [input.matchId],
    );

    if (existing.rows.length === 0) {
      throw new Error('match_not_found');
    }

    const match = existing.rows[0];
    if (!input.isAdmin) {
      if (input.actorUserId === match.host_user_id) {
        const hostAllowed = input.status === 'accepted' || input.status === 'rejected' || input.status === 'completed';
        if (!hostAllowed) {
          throw new Error('policy_denied');
        }
      } else if (input.actorUserId === match.seeker_user_id) {
        if (input.status !== 'cancelled') {
          throw new Error('policy_denied');
        }
      } else {
        throw new Error('policy_denied');
      }
    }

    const nextHostResponse = typeof input.hostResponse === 'undefined'
      ? match.host_response
      : normalizeNullableText(input.hostResponse);

    const updated = await (client as PoolClient).query<LighthouseMatchRow>(
      `
        UPDATE lighthouse_matches
        SET
          status = $2,
          host_response = $3,
          updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING
          id,
          property_id,
          seeker_user_id,
          host_user_id,
          message,
          proposed_move_in_date,
          host_response,
          status,
          created_at,
          updated_at,
          stream_channel_id
      `,
      [input.matchId, input.status, nextHostResponse],
    );

    return mapMatch(updated.rows[0]);
  });
}

export async function createBlock(actorUserId: string, blockedUserId: string, reason?: string): Promise<LighthouseBlock> {
  if (actorUserId === blockedUserId) {
    throw new Error('self_block');
  }

  const result = await queryDb<LighthouseBlockRow>(
    `
      INSERT INTO lighthouse_blocks (blocker_user_id, blocked_user_id, reason)
      VALUES ($1, $2, $3)
      ON CONFLICT (blocker_user_id, blocked_user_id)
      DO UPDATE SET reason = EXCLUDED.reason
      RETURNING id, blocker_user_id, blocked_user_id, reason, created_at
    `,
    [actorUserId, blockedUserId, normalizeNullableText(reason)],
  );

  return mapBlock(result.rows[0]);
}

export async function listBlocks(actorUserId: string): Promise<LighthouseBlock[]> {
  const result = await queryDb<LighthouseBlockRow>(
    `
      SELECT id, blocker_user_id, blocked_user_id, reason, created_at
      FROM lighthouse_blocks
      WHERE blocker_user_id = $1
      ORDER BY created_at DESC
    `,
    [actorUserId],
  );

  return result.rows.map(mapBlock);
}

export async function removeBlock(actorUserId: string, blockedUserId: string): Promise<boolean> {
  const result = await queryDb(
    `
      DELETE FROM lighthouse_blocks
      WHERE blocker_user_id = $1
        AND blocked_user_id = $2
    `,
    [actorUserId, blockedUserId],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function getLighthouseAdminStats(): Promise<{
  seekers: number;
  hosts: number;
  properties: number;
  activeMatches: number;
  completedMatches: number;
  generatedAtIso: string;
}> {
  const [seekers, hosts, properties, activeMatches, completedMatches] = await Promise.all([
    queryDb<CountRow>(`SELECT COUNT(*)::text AS total FROM lighthouse_profiles WHERE profile_type = 'seeker'`),
    queryDb<CountRow>(`SELECT COUNT(*)::text AS total FROM lighthouse_profiles WHERE profile_type = 'host'`),
    queryDb<CountRow>('SELECT COUNT(*)::text AS total FROM lighthouse_properties'),
    queryDb<CountRow>(`SELECT COUNT(*)::text AS total FROM lighthouse_matches WHERE status IN ('pending', 'accepted')`),
    queryDb<CountRow>(`SELECT COUNT(*)::text AS total FROM lighthouse_matches WHERE status = 'completed'`),
  ]);

  return {
    seekers: parseCountRow(seekers.rows),
    hosts: parseCountRow(hosts.rows),
    properties: parseCountRow(properties.rows),
    activeMatches: parseCountRow(activeMatches.rows),
    completedMatches: parseCountRow(completedMatches.rows),
    generatedAtIso: new Date().toISOString(),
  };
}

export async function listLighthouseProfiles(profileType?: 'seeker' | 'host'): Promise<LighthouseProfile[]> {
  const result = await queryDb<LighthouseProfileRow>(
    `
      SELECT
        id,
        user_id,
        profile_type,
        bio,
        phone_number,
        signal_url,
        is_active,
        has_property,
        housing_needs,
        desired_move_in_date,
        budget_min,
        budget_max,
        desired_country,
        updated_at
      FROM lighthouse_profiles
      WHERE ($1::text IS NULL OR profile_type = $1)
      ORDER BY updated_at DESC
    `,
    [profileType ?? null],
  );

  return result.rows.map(mapProfile);
}

export async function listLighthousePropertiesAdmin(): Promise<LighthouseProperty[]> {
  const result = await queryDb<LighthousePropertyRow>(
    `
      SELECT
        id,
        host_user_id,
        title,
        description,
        property_type,
        address_line,
        city,
        state,
        country,
        zip_code,
        bedrooms,
        bathrooms,
        monthly_rent,
        rent_currency,
        available_from,
        amenities,
        house_rules,
        photos,
        airbnb_profile_url,
        is_active,
        updated_at
      FROM lighthouse_properties
      ORDER BY updated_at DESC
    `,
  );

  return attachAcceptedCurrencies(result.rows.map(mapProperty));
}

export async function listLighthouseMatchesAdmin(): Promise<LighthouseMatch[]> {
  const result = await queryDb<LighthouseMatchRow>(
    `
      SELECT
        id,
        property_id,
        seeker_user_id,
        host_user_id,
        message,
        proposed_move_in_date,
        host_response,
        status,
        created_at,
        updated_at,
        stream_channel_id
      FROM lighthouse_matches
      ORDER BY updated_at DESC
    `,
  );

  return result.rows.map(mapMatch);
}

export async function insertLighthouseAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  // The audit contract (LIGHTHOUSE_PLUGIN_AUDIT_CONTRACTS.yaml) requires every event to carry
  // commandVersion, a structured policyDecision.evidence object, a targetContext.workspaceId, and
  // top-level requestId + traceId for cross-service correlation and compliance tracing. The
  // existing columns (actor_id, command, policy_status, reason, target_type, target_id) cover the
  // flat fields; the remaining contract fields are folded into the metadata jsonb column so the
  // stored record matches the contract shape without a schema migration. All of these are optional
  // at the call site so existing callers keep compiling; when a caller omits one, the helper
  // records 'unknown' / 'none' / {} rather than dropping the field, so the serialized payload
  // always matches the schema shape.
  commandVersion?: string;
  workspaceId?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  evidence?: Record<string, string>;
  result?: 'success' | 'failure';
  errorCategory?: string | null;
}): Promise<void> {
  const auditEnvelope = {
    eventId: randomUUID(),
    commandVersion: input.commandVersion ?? '1.0.0',
    policyDecision: {
      status: input.policyStatus,
      reason: input.reason,
      evidence: input.evidence ?? {},
    },
    targetContext: {
      workspaceId: input.workspaceId ?? 'unknown',
      targetType: input.targetType,
      targetId: input.targetId,
    },
    requestId: input.requestId ?? 'unknown',
    traceId: input.traceId ?? 'unknown',
    result: {
      status: input.result ?? 'success',
      errorCategory: input.errorCategory ?? 'none',
    },
    metadata: parseJsonObject(input.metadata),
  };

  await queryDb(
    `
      INSERT INTO lighthouse_admin_audit_trail
        (actor_id, command, policy_status, reason, target_type, target_id, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      input.actorId,
      input.command,
      input.policyStatus,
      input.reason,
      input.targetType,
      input.targetId,
      JSON.stringify(auditEnvelope),
    ],
  );
}

type NormalizedAuditEnvelope = {
  commandVersion: string;
  evidence: Record<string, unknown>;
  workspaceId: string;
  requestId: string;
  traceId: string;
  result: { status: string; errorCategory: string };
  metadata: Record<string, unknown>;
};

// Newer rows store the full contract envelope in the metadata column; older rows stored only the
// caller's flat metadata. Detect the envelope by its marker keys and fall back gracefully so both
// shapes read back without error.
function normalizeAuditEnvelope(stored: Record<string, unknown>): NormalizedAuditEnvelope {
  const isEnvelope = typeof stored.policyDecision === 'object' && stored.policyDecision !== null;
  if (!isEnvelope) {
    return {
      commandVersion: '1.0.0',
      evidence: {},
      workspaceId: 'unknown',
      requestId: 'unknown',
      traceId: 'unknown',
      result: { status: 'success', errorCategory: 'none' },
      metadata: stored,
    };
  }

  const policyDecision = parseJsonObject(stored.policyDecision);
  const targetContext = parseJsonObject(stored.targetContext);
  const resultBlock = parseJsonObject(stored.result);
  return {
    commandVersion: String(stored.commandVersion ?? '1.0.0'),
    evidence: parseJsonObject(policyDecision.evidence),
    workspaceId: String(targetContext.workspaceId ?? 'unknown'),
    requestId: String(stored.requestId ?? 'unknown'),
    traceId: String(stored.traceId ?? 'unknown'),
    result: {
      status: String(resultBlock.status ?? 'success'),
      errorCategory: String(resultBlock.errorCategory ?? 'none'),
    },
    metadata: parseJsonObject(stored.metadata),
  };
}

export async function listLighthouseAuditEvents(limit = 100): Promise<Array<{
  actorId: string;
  command: string;
  commandVersion: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  evidence: Record<string, unknown>;
  targetType: string;
  targetId: string;
  workspaceId: string;
  requestId: string;
  traceId: string;
  result: { status: string; errorCategory: string };
  metadata: Record<string, unknown>;
  createdAtIso: string;
}>> {
  const boundedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const result = await queryDb<{
    actor_id: string;
    command: string;
    policy_status: 'allow' | 'deny';
    reason: string;
    target_type: string;
    target_id: string;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `
      SELECT actor_id, command, policy_status, reason, target_type, target_id, metadata, created_at
      FROM lighthouse_admin_audit_trail
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [boundedLimit],
  );

  return result.rows.map((row) => {
    const envelope = normalizeAuditEnvelope(parseJsonObject(row.metadata));

    return {
      actorId: row.actor_id,
      command: row.command,
      commandVersion: envelope.commandVersion,
      policyStatus: row.policy_status,
      reason: row.reason,
      evidence: envelope.evidence,
      targetType: row.target_type,
      targetId: row.target_id,
      workspaceId: envelope.workspaceId,
      requestId: envelope.requestId,
      traceId: envelope.traceId,
      result: envelope.result,
      metadata: envelope.metadata,
      createdAtIso: toIso(row.created_at),
    };
  });
}
