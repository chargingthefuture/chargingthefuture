import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { setMemberRole } from 'lib/chyme/moderation';
import { muteMemberInCall, setCallMemberRole } from 'lib/chyme/stream-moderation';
import { recordModerationAudit, missingField, recordModerationAuditFailure, moderationResponse, readJsonBody, requireChymeAdminModerationAccess, stringField } from '../_shared';

// POST /api/chyme/admin/role  { userId, role: 'speaker' | 'listener' }  (+ ?room=)
// Hand-raise mode: let a member speak, or move them back to listening. Moving to listening also
// mutes them in the call, so the change is heard at once rather than on their next unmute.
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
  const role = stringField(body, 'role');
  if (role !== 'speaker' && role !== 'listener') {
    return NextResponse.json({ ok: false, code: CHYME_ERROR_CODE.invalidPayload, message: "role must be 'speaker' or 'listener'." }, { status: 400 });
  }
  const audit = { actorId: access.gate.auth.userId, command: 'chyme.admin.role' as const, targetType: 'member', targetId: userId, roomKey: access.roomKey };
  try {
    const { username } = await setMemberRole(access.roomKey, userId, role);
    const roleResult = await setCallMemberRole(access.roomKey, userId, role);
    const muteResult = role === 'listener' ? await muteMemberInCall(access.roomKey, userId) : { ok: true as const };
    const stream = roleResult.ok ? muteResult : roleResult;
    await recordModerationAudit({ ...audit, metadata: { username, role, streamApplied: stream.ok } });
    return moderationResponse(stream, { username, role });
  } catch (error) {
    return recordModerationAuditFailure(error, { ...audit, metadata: { role } }, 'admin_role');
  }
}
