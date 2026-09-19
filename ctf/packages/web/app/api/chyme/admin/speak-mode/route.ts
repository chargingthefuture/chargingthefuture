import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE, isChymeSpeakMode } from 'lib/chyme/constants';
import { setRoomSpeakMode } from 'lib/chyme/moderation';
import { muteMembersInCall, setCallMemberRole } from 'lib/chyme/stream-moderation';
import { recordModerationAudit, recordModerationAuditFailure, moderationResponse, readJsonBody, requireChymeAdminModerationAccess } from '../_shared';

// POST /api/chyme/admin/speak-mode  { mode: 'open' | 'hand_raise' }  (+ ?room=)
// Switch how the room decides who may speak. Switching to hand-raise turns everyone present except
// this admin into a listener and mutes them in the call; switching to open lets everyone unmute
// again (the role column is not read in open mode; Stream roles are reset to the default).
export async function POST(request: Request) {
  const access = await requireChymeAdminModerationAccess(request);
  if (!access.allowed) {
    return access.response;
  }
  const body = await readJsonBody(request);
  const mode = body.mode;
  if (!isChymeSpeakMode(mode)) {
    return NextResponse.json({ ok: false, code: CHYME_ERROR_CODE.invalidPayload, message: "mode must be 'open' or 'hand_raise'." }, { status: 400 });
  }
  const audit = { actorId: access.gate.auth.userId, command: 'chyme.admin.speak-mode' as const, targetType: 'room', targetId: access.roomKey, roomKey: access.roomKey };
  try {
    const { demotedUserIds } = await setRoomSpeakMode(access.roomKey, mode, access.gate.identity);
    let stream = await muteMembersInCall(access.roomKey, mode === 'hand_raise' ? demotedUserIds : []);
    for (const userId of demotedUserIds) {
      const roleResult = await setCallMemberRole(access.roomKey, userId, 'listener');
      if (!roleResult.ok && stream.ok) {
        stream = roleResult;
      }
    }
    await recordModerationAudit({ ...audit, metadata: { mode, demoted: demotedUserIds.length, streamApplied: stream.ok } });
    return moderationResponse(stream, { mode, demoted: demotedUserIds.length });
  } catch (error) {
    return recordModerationAuditFailure(error, { ...audit, metadata: { mode } }, 'admin_speak_mode');
  }
}
