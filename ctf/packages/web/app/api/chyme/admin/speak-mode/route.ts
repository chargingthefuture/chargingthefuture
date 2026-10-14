import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE, isChymeSpeakMode } from 'lib/chyme/constants';
import { setRoomSpeakMode } from 'lib/chyme/moderation';
import { muteMembersInCall, setCallMemberRole } from 'lib/chyme/stream-moderation';
import { recordModerationAudit, recordModerationAuditFailure, moderationResponse, readJsonBody, requireChymeAdminModerationAccess } from '../_shared';

// POST /api/chyme/admin/speak-mode  { mode: 'open' | 'hand_raise' }  (+ ?room=)
// Switch how the room decides who may speak. Switching to hand-raise turns everyone present except
// this admin into a listener, mutes them in the call and gives them the listener role there;
// switching to open lets everyone unmute again (the role column is not read in open mode) and puts
// everyone present back on the default Stream role. A member who joins later gets the role the
// mode calls for from the join route.
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
    const { demotedUserIds, restoredUserIds } = await setRoomSpeakMode(access.roomKey, mode, access.gate.identity);
    let stream = await muteMembersInCall(access.roomKey, mode === 'hand_raise' ? demotedUserIds : []);
    const roleChanges = [
      ...demotedUserIds.map((userId) => ({ userId, role: 'listener' as const })),
      ...restoredUserIds.map((userId) => ({ userId, role: 'speaker' as const })),
    ];
    for (const change of roleChanges) {
      const roleResult = await setCallMemberRole(access.roomKey, change.userId, change.role);
      if (!roleResult.ok && stream.ok) {
        stream = roleResult;
      }
    }
    await recordModerationAudit({
      ...audit,
      metadata: { mode, demoted: demotedUserIds.length, restored: restoredUserIds.length, streamApplied: stream.ok },
    });
    return moderationResponse(stream, { mode, demoted: demotedUserIds.length });
  } catch (error) {
    return recordModerationAuditFailure(error, { ...audit, metadata: { mode } }, 'admin_speak_mode');
  }
}
