import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { normalizeInviteCode } from 'lib/directory/invite-input';
import {
  clampInvitePage,
  countDirectoryInvitesByVisibility,
  countDirectoryListedPeople,
  getDirectoryInviteCardByCode,
  listLatestDirectoryInviteCards,
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
// `?invite=<code>` also answers that one person's card, for a direct link. The value is looked up only
// as an invite's random code, never as a Quora handle: a value that is not a code answers
// `invite: null`, so nobody can confirm who has an invitation by guessing handles. No card carries a
// handle either; each card's address opens it by code.
//
// For the signed-out Directory page it also answers `openWall`, one page (`?page=`, ten a page,
// clamped) of the public invites as cards, which are already public on the blog, and `lockedCount`,
// how many private invites there are. Nothing else about the private invites: the page draws its
// blurred cards as placeholders, with no names in them.

// The landing site and the blog read this from the browser, so only those origins are named.
const ALLOWED_ORIGINS = new Set([
  'https://lagatos.com',
  'https://www.lagatos.com',
  // The old addresses redirect to lagatos.com; kept while a cached page may still call from them.
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
  const code = normalizeInviteCode(params.get('invite'));

  try {
    const [invites, listed, invite, counts] = await Promise.all([
      listLatestDirectoryInviteCards(),
      countDirectoryListedPeople(),
      code ? getDirectoryInviteCardByCode(code) : Promise.resolve(null),
      countDirectoryInvitesByVisibility(),
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
      { ok: true, listed, invites, invite, openWall, lockedCount: counts.locked },
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
