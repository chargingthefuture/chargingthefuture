import { removeMemberFromRoom } from 'lib/chyme/moderation';
import { blockMemberFromCall } from 'lib/chyme/stream-moderation';
import { recordModerationAudit, missingField, recordModerationAuditFailure, moderationResponse, readJsonBody, requireChymeAdminModerationAccess, stringField } from '../_shared';

// POST /api/chyme/admin/remove  { userId, reason? }  (+ ?room=)
// Remove a member from the room and keep them out: the presence row goes, a removal row is kept
// (join and heartbeat refuse while it stands), and Stream blocks them from the call. Lifted from the
// Chyme admin screen.
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
  const reason = stringField(body, 'reason')?.slice(0, 300) ?? null;
  const audit = { actorId: access.gate.auth.userId, command: 'chyme.admin.remove' as const, targetType: 'member', targetId: userId, roomKey: access.roomKey };
  try {
    const { username } = await removeMemberFromRoom(access.roomKey, userId, access.gate.identity, reason);
    const stream = await blockMemberFromCall(access.roomKey, userId);
    await recordModerationAudit({ ...audit, metadata: { username, reason, streamApplied: stream.ok } });
    return moderationResponse(stream, { username });
  } catch (error) {
    return recordModerationAuditFailure(error, audit, 'admin_remove');
  }
}
