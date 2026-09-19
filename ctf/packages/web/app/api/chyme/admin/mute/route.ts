import { muteMemberInCall } from 'lib/chyme/stream-moderation';
import { recordModerationAudit, missingField, recordModerationAuditFailure, moderationResponse, readJsonBody, requireChymeAdminModerationAccess, stringField } from '../_shared';

// POST /api/chyme/admin/mute  { userId }  (+ ?room=)
// Turn a member's microphone off in the call. Nothing is stored beyond the audit row: in open mode
// the member can unmute again; in hand-raise mode their listener role decides.
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
  const audit = { actorId: access.gate.auth.userId, command: 'chyme.admin.mute' as const, targetType: 'member', targetId: userId, roomKey: access.roomKey };
  try {
    const stream = await muteMemberInCall(access.roomKey, userId);
    await recordModerationAudit({ ...audit, metadata: { streamApplied: stream.ok } });
    return moderationResponse(stream);
  } catch (error) {
    return recordModerationAuditFailure(error, audit, 'admin_mute');
  }
}
