import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { liftRoomRemoval } from 'lib/chyme/moderation';
import { unblockMemberFromCall } from 'lib/chyme/stream-moderation';
import { recordModerationAudit, missingField, recordModerationAuditFailure, moderationResponse, readJsonBody, requireChymeAdminModerationAccess, stringField } from '../_shared';

// POST /api/chyme/admin/lift-removal  { userId }  (+ ?room=)
// Let a removed member back in: the removal row is lifted (kept as the record) and Stream unblocks
// them from the call. They join again like anybody else.
export async function POST(request: Request) {
  const access = await requireChymeAdminModerationAccess(request);
  if (!access.allowed) {
    return access.response;
  }
  const body = await readJsonBody(request);
  const userId = stringField(body, 'userId');
  if (!userId) {
    return missingField('userId');
  }
  const audit = { actorId: access.gate.auth.userId, command: 'chyme.admin.lift-removal' as const, targetType: 'member', targetId: userId, roomKey: access.roomKey };
  try {
    const lifted = await liftRoomRemoval(access.roomKey, userId, access.gate.identity);
    if (!lifted) {
      await recordModerationAudit({ ...audit, metadata: { lifted: false } });
      return NextResponse.json(
        { ok: false, code: CHYME_ERROR_CODE.memberNotInRoom, message: 'That member is not removed from this room.' },
        { status: 409 },
      );
    }
    const stream = await unblockMemberFromCall(access.roomKey, userId);
    await recordModerationAudit({ ...audit, metadata: { lifted: true, streamApplied: stream.ok } });
    return moderationResponse(stream);
  } catch (error) {
    return recordModerationAuditFailure(error, audit, 'admin_lift_removal');
  }
}
