import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayAdminAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { SOCKET_RELAY_ERROR_CODE } from 'lib/socket-relay/constants';
import { deleteRequestImage } from 'lib/socket-relay/images';
import { insertSocketRelayAudit } from 'lib/socket-relay/repository';
import { restrictAccount } from 'lib/auth/account-restrictions';
import { reportError } from 'lib/observability/report';

// Admin removal of a request's picture. `?ban=1` also bans the member who uploaded it.
//
// An inappropriate picture on SocketRelay is an automatic ban with no exceptions (owner decision,
// 2026-10-02). Every uploader ticked that warning before choosing the file. The ban is an account
// restriction at scope `all`, the same one the account restrictions screen applies, so it can be lifted
// there. Plain removal without `ban` is for a picture that is fine but does not fit the listing.

type RouteProps = { params: Promise<{ id: string }> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOCKET_RELAY_IMAGE_BAN_REASON = 'Inappropriate picture uploaded to SocketRelay (automatic ban, no exceptions).';

// The picture is gone before the ban is written, so a failed ban leaves nothing on show. The audit row
// names the uploader in both cases, so a failed ban can be applied by hand from it. An admin who
// replaced a member's picture is its uploader of record, so the acting admin is never banned.
async function auditAndBan(requestId: string, actorId: string, uploaderId: string, ban: boolean): Promise<boolean> {
  await insertSocketRelayAudit({
    actorId,
    command: ban ? 'socket-relay.admin.image.delete_and_ban' : 'socket-relay.admin.image.delete',
    policyStatus: 'allow',
    reason: ban ? 'inappropriate_image' : 'ok',
    targetType: 'request',
    targetId: requestId,
    metadata: { uploadedByUserId: uploaderId },
  });
  const banned = ban && uploaderId !== actorId;
  if (banned) {
    await restrictAccount({ targetUserId: uploaderId, actorId, scope: 'all', reason: SOCKET_RELAY_IMAGE_BAN_REASON });
  }
  return banned;
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireSocketRelayAdminAccess();
  if (!gate.allowed) return gate.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'That request address is not valid.' }, { status: 400 });
  }
  const ban = new URL(request.url).searchParams.get('ban') === '1';

  try {
    const removed = await deleteRequestImage(id, gate.auth.userId, true);
    if (!removed) {
      return NextResponse.json({ ok: false, code: SOCKET_RELAY_ERROR_CODE.requestNotFound, message: 'That request has no picture to remove.' }, { status: 404 });
    }
    const banned = await auditAndBan(id, gate.auth.userId, removed.uploadedByUserId, ban);
    return NextResponse.json({ ok: true, banned }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'admin_image_delete' });
    return socketRelayErrorResponse(error, ban ? 'The picture removal and ban did not complete. Check the account restrictions screen before trying again.' : 'The picture was not removed. Try again in a moment.');
  }
}
