import { NextResponse } from 'next/server';
import { queryDb } from 'lib/db/postgres';
import { checkRateLimit } from 'lib/security/rate-limit';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import {
  requireDirectoryServiceRead,
  SERVICE_PROFILE_SELECT_SQL,
  SERVICE_RESTRICTION_FILTER_SQL,
  toServiceProfile,
  type DirectoryProfileForService,
  type DirectoryServiceGate,
  type ServiceProfileRow,
} from 'lib/directory/service-read';

// A page of Directory profiles for One Percent's Find matches (owner decision, 2026-10-07; the
// "One Percent is the paid tier" section of CLAUDE.md). Find matches runs on the owner's desk
// only: it puts the owner's own notes beside Directory profiles and asks a drafting model to
// suggest introductions for the owner to decide on. The owner did that before by recalling
// conversations and scanning profiles one by one.
//
// Everything the single read promises holds here, enforced the same way:
//
// - The same fields, from the same projection (SERVICE_PROFILE_SELECT_SQL), and nothing more.
//   Directory profiles hold no field for what somebody needs or is looking for, so there is none
//   to return. Never the bio, payment addresses, the claiming account id or who nominated them.
// - The same exclusions, in the query: a deleted profile is gone from the table, and a claimed one
//   whose owner is restricted with scope 'all' or 'contact' never appears. 'trading' alone doesn't
//   hide one, and nothing in the page says somebody was left out.
// - A page, not a search. The only inputs are where to start and how many. There is no filter by
//   sector, job title or date because none of those columns is indexed, and a filter that scans
//   the table is not cheaper than walking it.
// - A pointer, not a copy. One Percent may keep a profile id on a suggestion and nothing else.
//
// The order is creation time then id, both fixed for the life of a row, so an edit made while One
// Percent is walking the pages never moves a profile to a page it has already read.

export const SERVICE_LIST_DEFAULT_LIMIT = 50;
export const SERVICE_LIST_MAX_LIMIT = 100;

// Per consumer, not per address, so a credential can't spread its pages across addresses. One
// page a second at most, and sixty an hour: six thousand profiles at the largest page size, far
// more than the Directory holds, so a Find matches run never meets it.
export const SERVICE_LIST_BURST_LIMIT = 1;
export const SERVICE_LIST_BURST_WINDOW_MS = 1_000;
export const SERVICE_LIST_HOURLY_LIMIT = 60;
export const SERVICE_LIST_HOURLY_WINDOW_MS = 3_600_000;

function tooMany(retryAfterSeconds: number, message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: DIRECTORY_ERROR_CODE.serviceRateLimited, message },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

export function requireDirectoryServiceList(request: Request): DirectoryServiceGate {
  const gate = requireDirectoryServiceRead(request);
  if (!gate.allowed) {
    return gate;
  }
  const burst = checkRateLimit(
    `directory-service-list:burst:${gate.actorId}`,
    SERVICE_LIST_BURST_LIMIT,
    SERVICE_LIST_BURST_WINDOW_MS,
  );
  if (!burst.allowed) {
    return {
      allowed: false,
      response: tooMany(burst.retryAfterSeconds, 'One page of Directory profiles a second. Wait a second and ask for the next page.'),
    };
  }
  const hourly = checkRateLimit(
    `directory-service-list:hourly:${gate.actorId}`,
    SERVICE_LIST_HOURLY_LIMIT,
    SERVICE_LIST_HOURLY_WINDOW_MS,
  );
  if (!hourly.allowed) {
    return {
      allowed: false,
      response: tooMany(
        hourly.retryAfterSeconds,
        `This credential has read ${SERVICE_LIST_HOURLY_LIMIT} pages of Directory profiles in the last hour. Try again after the time in Retry-After.`,
      ),
    };
  }
  return gate;
}

// The cursor is opaque to the caller: base64url of the last row's position and the page number.
// The page number is there so the audit can say where a call was without naming a profile.
type Cursor = { createdAt: string; id: string; page: number };

const CURSOR_CREATED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const PROFILE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify({ c: cursor.createdAt, i: cursor.id, n: cursor.page }), 'utf8').toString('base64url');
}

function isPageNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 2 && n <= 1_000_000;
}

function cursorFields(parsed: unknown): Cursor | null {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const { c, i, n } = parsed as Record<string, unknown>;
  const createdAtOk = typeof c === 'string' && CURSOR_CREATED_AT.test(c);
  const idOk = typeof i === 'string' && PROFILE_ID.test(i);
  if (!createdAtOk || !idOk || !isPageNumber(n)) {
    return null;
  }
  return { createdAt: c as string, id: i as string, page: n };
}

export function decodeCursor(raw: string): Cursor | null {
  if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
    return null;
  }
  try {
    return cursorFields(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
  } catch {
    return null;
  }
}

export type ServiceListParams =
  | { ok: true; limit: number; cursor: Cursor | null }
  | { ok: false; message: string };

export function parseServiceListParams(url: URL): ServiceListParams {
  const rawLimit = url.searchParams.get('limit');
  let limit = SERVICE_LIST_DEFAULT_LIMIT;
  if (rawLimit !== null && rawLimit !== '') {
    if (!/^\d{1,6}$/.test(rawLimit) || Number(rawLimit) < 1) {
      return { ok: false, message: `limit must be a number from 1 to ${SERVICE_LIST_MAX_LIMIT}, with no fraction.` };
    }
    limit = Math.min(Number(rawLimit), SERVICE_LIST_MAX_LIMIT);
  }
  const rawCursor = url.searchParams.get('cursor');
  if (rawCursor === null || rawCursor === '') {
    return { ok: true, limit, cursor: null };
  }
  const cursor = decodeCursor(rawCursor);
  if (!cursor) {
    return { ok: false, message: 'cursor is not one this route gave out. Start again without a cursor.' };
  }
  return { ok: true, limit, cursor };
}

export type DirectoryProfilePage = {
  profiles: DirectoryProfileForService[];
  nextCursor: string | null;
};

type ListRow = ServiceProfileRow & { cursor_created_at: string };

export async function listProfilesForService(limit: number, cursor: Cursor | null): Promise<DirectoryProfilePage> {
  const size = Math.min(Math.max(1, Math.trunc(limit)), SERVICE_LIST_MAX_LIMIT);
  const params: unknown[] = [size + 1];
  let after = '';
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    after = 'AND (p.created_at, p.id::text) > ($2::timestamptz, $3::text)';
  }
  const result = await queryDb<ListRow>(
    `
      SELECT
        to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
        ${SERVICE_PROFILE_SELECT_SQL}
      WHERE ${SERVICE_RESTRICTION_FILTER_SQL}
        ${after}
      ORDER BY p.created_at ASC, p.id::text ASC
      LIMIT $1
    `,
    params,
  );
  const rows = result.rows.slice(0, size);
  const last = rows[rows.length - 1];
  const nextCursor =
    result.rows.length > size && last
      ? encodeCursor({ createdAt: last.cursor_created_at, id: last.id, page: (cursor?.page ?? 1) + 1 })
      : null;
  return { profiles: rows.map(toServiceProfile), nextCursor };
}

export function invalidListParams(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message }, { status: 400 });
}
