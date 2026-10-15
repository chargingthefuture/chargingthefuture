import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { normalizeInviteHandle } from 'lib/directory/invite-input';
import {
  clampInvitePage,
  countDirectoryInvitesByVisibility,
  countDirectoryListedPeople,
  getDirectoryInviteCardByHandle,
  listLatestDirectoryInviteCards,
  listLockedDirectoryInviteTeasers,
  listOpenDirectoryInviteCards,
} from 'lib/directory/invites';
import { failureResponse } from 'lib/errors/failure';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

export const dynamic = 'force-dynamic';

// Public: the newest ten invites as cards, and how many people the Directory lists (owner decision,
// 2026-10-15). Read by the signed-out Directory page, the floating invite card on signed-out plugin
// pages, the landing site and the blog. A card is the person's name, the invite's opening words, its
// date and the address that opens it in the app, plus the blog address when the invite is one of
// those already published on the blog. Nothing else about a private invite leaves here: no skills,
// location, picture or Quora address, and no line naming anybody as a Targeted Individual.
//
// `?invite=<handle>` also answers that one person's card, for a direct link.
//
// For the signed-out Directory page it also answers `openWall`, one page (`?page=`, ten a page,
// clamped) of the public invites as cards, which are already public on the blog, and
// `lockedCount` with `lockedTeasers`, the newest private invites as name and opening only, which
// the page shows blurred.

// The landing site and the blog read this from the browser, so only those origins are named.
const ALLOWED_ORIGINS = new Set([
  'https://chargingthefuture.com',
  'https://www.chargingthefuture.com',
  'https://chargingthefuture.github.io',
]);

function corsHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin', 'Cache-Control': 'public, max-age=60' };
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return headers;
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'directory-invites-public');
  if (limited) {
    return limited;
  }

  const params = new URL(request.url).searchParams;
  const rawHandle = params.get('invite');
  const handle = rawHandle === null ? null : normalizeInviteHandle(rawHandle);

  try {
    const [invites, listed, invite, counts, lockedTeasers] = await Promise.all([
      listLatestDirectoryInviteCards(),
      countDirectoryListedPeople(),
      handle ? getDirectoryInviteCardByHandle(handle) : Promise.resolve(null),
      countDirectoryInvitesByVisibility(),
      listLockedDirectoryInviteTeasers(),
    ]);
    const paging = clampInvitePage(params.get('page') ?? '1', counts.open);
    const openInvites = await listOpenDirectoryInviteCards(paging.pageSize, paging.offset);
    const openWall = {
      total: counts.open,
      page: paging.page,
      pageCount: paging.pageCount,
      pageSize: paging.pageSize,
      from: paging.from,
      to: paging.to,
      invites: openInvites,
    };
    return NextResponse.json(
      { ok: true, listed, invites, invite, openWall, lockedCount: counts.locked, lockedTeasers },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    const response = failureResponse({
      summary: 'Could not read the invitations',
      error,
      code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
      area: 'directory',
      op: 'public_invites',
      audience: 'member',
    });
    for (const [key, value] of Object.entries(corsHeaders(request))) {
      if (key !== 'Cache-Control') response.headers.set(key, value);
    }
    return response;
  }
}
