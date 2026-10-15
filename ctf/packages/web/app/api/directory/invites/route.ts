import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { requireInviteReader } from 'lib/directory/invite-access';
import { normalizeInviteHandle } from 'lib/directory/invite-input';
import {
  clampInvitePage,
  countDirectoryInvites,
  countDirectoryListedPeople,
  getDirectoryInviteByHandle,
  listDirectoryInvites,
} from 'lib/directory/invites';
import { failureResponse } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// The invite wall in full, for any signed-in account (owner decision, 2026-10-15; the gate and its
// reason are in lib/directory/invite-access.ts). One page of ten, newest first. `?page=` is 1-based
// and clamped into range, so a page past the end answers with the last page rather than nothing.
// `?invite=<handle>` adds that one invite on top, for a member who followed a direct link.
// Picture bytes are not in here; each invite carries the address of its picture.
export async function GET(request: Request) {
  const gate = await requireInviteReader();
  if (!gate.allowed) {
    return gate.response;
  }

  const params = new URL(request.url).searchParams;
  const handle = normalizeInviteHandle(params.get('invite'));

  try {
    const [total, listed, featured] = await Promise.all([
      countDirectoryInvites(),
      countDirectoryListedPeople(),
      handle ? getDirectoryInviteByHandle(handle) : Promise.resolve(null),
    ]);
    const paging = clampInvitePage(params.get('page') ?? '1', total);
    const invites = await listDirectoryInvites(paging.pageSize, paging.offset);
    return NextResponse.json(
      {
        ok: true,
        listed,
        total,
        page: paging.page,
        pageCount: paging.pageCount,
        pageSize: paging.pageSize,
        from: paging.from,
        to: paging.to,
        invite: featured,
        invites,
      },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return failureResponse({
      summary: 'Could not read the invitations',
      error,
      code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
      area: 'directory',
      op: 'member_invites',
      audience: 'member',
    });
  }
}
