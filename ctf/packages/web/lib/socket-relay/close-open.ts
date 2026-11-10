import { withDbTransaction } from 'lib/db/postgres';
import { clearMemberPresence } from 'lib/presence/live';

// The poster closes their own open request from Today, with the outcome they pick: 'closed' when it
// was done, 'canceled' when it was closed without being done. Only an open request nobody has claimed
// closes here; a claimed one closes through its fulfillment, as before. Recorded in
// socket_relay_request_events as `request_closed_by_owner` with the outcome.
export async function closeOpenRequestByOwner(requestId: string, ownerUserId: string, done: boolean): Promise<boolean> {
  const closed = await withDbTransaction(async (client) => {
    const result = await client.query(
      `UPDATE socket_relay_requests SET status = $3, updated_at = NOW()
       WHERE id = $1::uuid AND owner_user_id = $2 AND status = 'open'`,
      [requestId, ownerUserId, done ? 'closed' : 'canceled'],
    );
    if ((result.rowCount ?? 0) === 0) return false;
    await client.query(
      `INSERT INTO socket_relay_request_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, 'request_closed_by_owner', jsonb_build_object('outcome', $3::text))`,
      [requestId, ownerUserId, done ? 'done' : 'not_done'],
    );
    return true;
  });
  if (closed) {
    // The post no longer makes its owner active in SocketRelay. Best-effort: it reports its own failure.
    await clearMemberPresence({ userId: ownerUserId, pluginSlug: 'socket-relay', refType: 'post', refId: requestId });
  }
  return closed;
}
